import fs from 'fs';
import path from 'path';
import axios from 'axios';
import * as dotenv from 'dotenv';
import blockchainService from '../src/services/blockchain/blockchainService';
import logger from '../src/utils/logger';
import config from '../src/config';

// Load environment variables
dotenv.config();

// Define types
interface Recipient {
  address: string;
  topUpDate: string;
  lockerAddress?: string;
  lockerCheckedDate?: string;
  claimed?: boolean;
  lastChecked?: string;
}

interface BootedUser {
  address: string;
  nonce: number;
  pointsRemoved: boolean;
  removedDate: string;
}

// Constants
const BOOTED_USERS_FILE = path.join(__dirname, '..', 'data', 'booted-users.json');
const STORED_RECIPIENTS_FILE = path.join(__dirname, '..', 'data', 'stored-recipients.json');
const PROD_API_URL = 'https://superfluid-eligibility-api.s.superfluid.dev/recipients-stored';
const NONCE_THRESHOLD = 5;
const POINTS_TO_REMOVE = 99;

// Function to download the recipients list from prod and save it
async function downloadAndSaveRecipientsList(force = false): Promise<Recipient[]> {
  // If the file already exists and we're not forcing a re-download, just read it
  if (fs.existsSync(STORED_RECIPIENTS_FILE) && !force) {
    try {
      logger.info('Using existing stored recipients list');
      const data = fs.readFileSync(STORED_RECIPIENTS_FILE, 'utf8');
      const recipients = JSON.parse(data);
      logger.info(`Loaded ${recipients.length} recipients from stored file`);
      return recipients;
    } catch (error) {
      logger.error('Failed to read stored recipients file, will attempt to download', { error });
      // Continue to download if we failed to read the file
    }
  }

  try {
    logger.info('Downloading recipients list from production API');
    const response = await axios.get(PROD_API_URL);
    const recipients = response.data;
    
    // Save the recipients to a file
    fs.writeFileSync(STORED_RECIPIENTS_FILE, JSON.stringify(recipients, null, 2));
    logger.info(`Downloaded and saved ${recipients.length} recipients to ${STORED_RECIPIENTS_FILE}`);
    
    return recipients;
  } catch (error) {
    logger.error('Failed to download recipients list', { error });
    
    // If we have a stored file but it couldn't be read earlier, try again as a fallback
    if (fs.existsSync(STORED_RECIPIENTS_FILE)) {
      logger.info('Falling back to stored recipients file despite earlier error');
      try {
        const data = fs.readFileSync(STORED_RECIPIENTS_FILE, 'utf8');
        return JSON.parse(data);
      } catch (fallbackError) {
        logger.error('Failed to read stored recipients file as fallback', { error: fallbackError });
      }
    }
    
    throw new Error(`Failed to download recipients list: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Function to get or create the booted users file
function getBootedUsers(): BootedUser[] {
  try {
    if (fs.existsSync(BOOTED_USERS_FILE)) {
      const data = fs.readFileSync(BOOTED_USERS_FILE, 'utf8');
      return JSON.parse(data);
    } else {
      // Make sure the directory exists
      const dir = path.dirname(BOOTED_USERS_FILE);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      
      // Create empty array
      fs.writeFileSync(BOOTED_USERS_FILE, JSON.stringify([], null, 2));
      return [];
    }
  } catch (error) {
    logger.error('Failed to read or create booted users file', { error });
    return [];
  }
}

// Function to save booted users
function saveBootedUsers(bootedUsers: BootedUser[]): void {
  try {
    fs.writeFileSync(BOOTED_USERS_FILE, JSON.stringify(bootedUsers, null, 2));
    logger.info(`Updated booted users file with ${bootedUsers.length} users`);
  } catch (error) {
    logger.error('Failed to save booted users', { error });
    throw new Error(`Failed to save booted users: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Function to check if user should be booted
async function checkIfUserShouldBeBooted(address: string): Promise<boolean> {
  try {
    const nonce = await blockchainService.getUserNonce(address as `0x${string}`);
    logger.info(`Address: ${address}, Nonce: ${nonce}`);
    return nonce < NONCE_THRESHOLD;
  } catch (error) {
    logger.error(`Failed to check nonce for address ${address}`, { error });
    // Default to false if we can't check
    return false;
  }
}

// Function to remove points from a user
async function removePointsFromUser(address: string): Promise<boolean> {
  try {
    // Get the API key from config or env
    const apiKey = process.env.STACK_WRITE_API_KEY;
    if (!apiKey) {
      logger.error('STACK_WRITE_API_KEY is not set in environment variables');
      return false;
    }

    // Direct implementation that bypasses stackApiService
    const url = `https://track.stack.so/event`;
    const data = [{
      "name": "remove_universal_allocation",
      "account": address.toLowerCase(),
      "pointSystemId": config.COMMUNITY_ACTIVATION_ID,
      "uniqueId": `remove-points`,
      "points": -99
    }];
    
    const response = await axios.post(url, data, {
      headers: {
        'x-api-key': apiKey,
        'Content-Type': 'application/json'
      }
    });

    if (response.status >= 200 && response.status < 300) {
      logger.info(`Successfully removed ${POINTS_TO_REMOVE} points from ${address}`);
      logger.slackNotify(`Removed ${POINTS_TO_REMOVE} points from ${address} due to low nonce`);
      return true;
    } else {
      logger.error(`Failed to remove points from ${address}, received status ${response.status}`);
      return false;
    }
  } catch (error) {
    logger.error(`Failed to remove points from ${address}`, { error });
    return false;
  }
}

// Parse command line arguments
function parseArgs(): { forceDownload: boolean; dryRun: boolean } {
  const args = process.argv.slice(2);
  return {
    forceDownload: args.includes('--force-download'),
    dryRun: args.includes('--dry-run')
  };
}

// Main function to process the recipients
async function main() {
  try {
    const { forceDownload, dryRun } = parseArgs();
    
    if (dryRun) {
      logger.info('DRY RUN MODE: No points will actually be removed');
    }
    
    // Step 1: Download the recipients list (or use cached version)
    const recipients = await downloadAndSaveRecipientsList(forceDownload);
    logger.info(`Loaded ${recipients.length} recipients`);
    
    // Step 2: Get the current booted users
    const bootedUsers = getBootedUsers();
    logger.info(`Loaded ${bootedUsers.length} previously booted users`);
    
    // Create a set of already booted addresses for faster lookup
    const bootedAddresses = new Set(bootedUsers.map(user => user.address.toLowerCase()));
    
    // Step 3: Process each recipient
    let processed = 0;
    for (const recipient of recipients) {
      // Skip if already booted
      if (bootedAddresses.has(recipient.address.toLowerCase())) {
        logger.info(`Skipping already booted user: ${recipient.address}`);
        continue;
      }
      
      // Step 4: Check if user should be booted
      const shouldBeBoot = await checkIfUserShouldBeBooted(recipient.address);
      
      if (shouldBeBoot) {
        // Step 5: Remove points
        const nonce = await blockchainService.getUserNonce(recipient.address as `0x${string}`);
        
        let pointsRemoved = false;
        if (!dryRun) {
          pointsRemoved = await removePointsFromUser(recipient.address);
        } else {
          logger.info(`DRY RUN: Would remove ${POINTS_TO_REMOVE} points from ${recipient.address}`);
          pointsRemoved = true; // Pretend it succeeded in dry run mode
        }
        
        // Step 6: Add to booted users
        bootedUsers.push({
          address: recipient.address,
          nonce,
          pointsRemoved,
          removedDate: new Date().toISOString()
        });
        
        // Save after each successful boot to avoid losing progress
        saveBootedUsers(bootedUsers);
        
        logger.info(`User ${recipient.address} with nonce ${nonce} has been booted and points removed: ${pointsRemoved}`);
      }
      
      processed++;
      if (processed % 10 === 0) {
        logger.info(`Processed ${processed}/${recipients.length} recipients`);
      }
    }
    
    logger.info('Processing complete!');
    logger.info(`Total recipients: ${recipients.length}`);
    logger.info(`Total booted users: ${bootedUsers.length}`);
    
  } catch (error) {
    logger.error('An error occurred during processing', { error });
    process.exit(1);
  }
}

// Run the main function
main()
  .then(() => {
    logger.info('Script completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    logger.error('Script failed', { error });
    process.exit(1);
  });
