import fs from 'fs';
import path from 'path';
import logger from './logger';
import axios from 'axios';
import eligibilityService from '../services/eligibilityService';
import blockchainService from '../services/blockchain/blockchainService';

interface UniversalPointRecipient {
  address: string;
  topUpDate: string;
  lockerAddress?: string;
  lockerCheckedDate?: string;
  claimed?: boolean;
  lastChecked?: string;
}

const STORAGE_FILE = 'UniversalPointRecipients.json';
const STORAGE_PATH = path.join(__dirname, '..', '..', 'data', STORAGE_FILE);

/**
 * Read all recipients from storage file
 */
export const getStoredRecipients = (): UniversalPointRecipient[] => {
  try {
    if (!fs.existsSync(STORAGE_PATH)) {
      return [];
    }
    const data = fs.readFileSync(STORAGE_PATH, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    logger.error('Failed to read recipients from storage', { error });
    return [];
  }
}

export const getRecipients = async (cache?: number): Promise<UniversalPointRecipient[]> => {
  await checkRecipients(cache);
  return getStoredRecipients();
}

/**
 * Write recipients to storage file
 * note: this is a private function and should only be called by the addRecipient and updateRecipient functions
 *       it is not exported from the module
 *       this is to avoid accidental corruption of the storage file
 */
const saveRecipients = (recipients: UniversalPointRecipient[]): boolean => {
  try {
    // Create the directory if it doesn't exist
    const dir = path.dirname(STORAGE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(STORAGE_PATH, JSON.stringify(recipients, null, 2));
    return true;
  } catch (error) {
    logger.error('Failed to save recipients to storage', { error });
    logger.slackNotify(`Failed to save recipients to storage ${error}`, 'error');
    return false;
  }
}

/**
 * Add a new recipient to storage
 */
export const addRecipient = (recipient: Partial<UniversalPointRecipient>): boolean => {
    if (!recipient.address) {
        logger.error('Recipient address is required');
        return false;
    }
    if (!recipient.topUpDate) {
        recipient.topUpDate = new Date().toISOString();
    }
  try {
    const recipients = getStoredRecipients();
    // Create a complete recipient object with all required fields
    const completeRecipient: UniversalPointRecipient = {
      address: recipient.address,
      topUpDate: recipient.topUpDate,
      lockerAddress: recipient.lockerAddress,
      lockerCheckedDate: recipient.lockerCheckedDate,
      claimed: recipient.claimed,
      lastChecked: recipient.lastChecked
    };
    recipients.push(completeRecipient);
    return saveRecipients(recipients);
  } catch (error) {
    logger.error('Failed to add recipient to storage', { error });
    return false;
  }
}

/**
 * Update an existing recipient in storage
 */
export const updateRecipient = (address: string, updates: Partial<UniversalPointRecipient>): boolean => {
  try {
    const recipients = getStoredRecipients();
    const index = recipients.findIndex(r => r.address.toLowerCase() === address.toLowerCase());
    
    if (index === -1) {
      logger.error(`Recipient ${address} not found in storage`);
      return false;
    }

    recipients[index] = {
      ...recipients[index],
      ...updates
    };

    return saveRecipients(recipients);
  } catch (error) {
    logger.error('Failed to update recipient in storage', { error });
    return false;
  }
}

/**
 * Get a single recipient by address
 */
export const getRecipient = (address: string): UniversalPointRecipient | null => {
  try {
    const recipients = getStoredRecipients();
    return recipients.find(r => r.address.toLowerCase() === address.toLowerCase()) || null;
  } catch (error) {
    logger.error('Failed to get recipient from storage', { error });
    return null;
  }
}

/**
 * Check all recipients for eligibility and update their statuses
 */
export const checkRecipients = async (cacheInvalidation?:number): Promise<void> => {
  const recipients = getStoredRecipients();
  const cacheInvalidationDuration = cacheInvalidation || 1000 * 60 * 20;
  const recipientsToCheck = recipients.filter(r => (!r.lockerAddress || !r.claimed) && (!r.lastChecked || new Date(r.lastChecked) < new Date(Date.now() - cacheInvalidationDuration))); // 20 minute cache
  const recipientAddressList = recipientsToCheck.map(r => r.address);
  const lockerAddresses = await blockchainService.getLockerAddresses(recipientAddressList);
  const claimStatuses = await blockchainService.checkAllClaimStatuses(lockerAddresses);
  for (const recipient of recipientsToCheck) {
    const result = claimStatuses.get(recipient.address);
    if (result) {
      updateRecipient(recipient.address, { claimed: true });
    }
    const lockerAddress = lockerAddresses.get(recipient.address);
    if (lockerAddress) {
      updateRecipient(recipient.address, { lockerAddress: lockerAddress, lockerCheckedDate: new Date().toISOString() });
    }
    recipient.lastChecked = new Date().toISOString();
    updateRecipient(recipient.address, { lastChecked: recipient.lastChecked });
  }
}

export const getHighLevelStats = async (): Promise<{
  totalRecipients: number;
  totalRecipientsWithLocker: number;
  totalRecipientsWithClaim: number;
}> => {
  const recipients = await getRecipients();
  return {
    totalRecipients: recipients.length,
    totalRecipientsWithLocker: recipients.filter(r => r.lockerAddress).length,
    totalRecipientsWithClaim: recipients.filter(r => r.claimed).length
  };
}

/**
 * Check how many recipients have been topped up in a given time period
 * @param timePeriod - The time period in seconds
 */
export const latestRecipients = (timePeriod: number): UniversalPointRecipient[] => {
  const recipients = getStoredRecipients();
  const recipientsToCheck = recipients.filter(r => (new Date(r.topUpDate)).getTime() > (new Date()).getTime() - timePeriod*1000);
  return recipientsToCheck;
}
