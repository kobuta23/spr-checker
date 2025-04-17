import fs from 'fs';
import path from 'path';
import pMemoize from 'p-memoize';
import { halfDayCache } from '../config/cache';
import logger from '../utils/logger';
import config from '../config';
import blockchainService from './blockchain/blockchainService';
import axios from 'axios';
import eligibilityService from './eligibilityService';

// Types
interface Referral {
  address: string;
  SUPincome: string;
}

interface Referrer {
  address: string;
  username: string;
  SUPincome: string;
  rank: number;
  maxReferrals: number;
  unusedCodes: string[];
  referrals: Referral[];
}

// Path to the JSON data file
const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'referrals.json');

// SUP income thresholds for ranks (in wei/s)
const RANK_THRESHOLDS = {
  RANK_4: BigInt("800000000000000"), // Highest rank
  RANK_3: BigInt("600000000000000"),
  RANK_2: BigInt("300000000000000"),
  RANK_1: BigInt("0")                // Lowest rank
};

// Max referrals per rank
const MAX_REFERRALS_BY_RANK = {
  4: 20, // Rank 4: 20 max referrals
  3: 10, // Rank 3: 10 max referrals
  2: 5,  // Rank 2: 5 max referrals
  1: 3   // Rank 1: 3 max referrals
};

/**
 * Determine rank and max referrals based on SUP income
 */
const determineRank = (SUPincome: string): { rank: number; maxReferrals: number } => {
  const income = BigInt(SUPincome);
  
  if (income >= RANK_THRESHOLDS.RANK_4) {
    return { rank: 4, maxReferrals: MAX_REFERRALS_BY_RANK[4] };
  } else if (income >= RANK_THRESHOLDS.RANK_3) {
    return { rank: 3, maxReferrals: MAX_REFERRALS_BY_RANK[3] };
  } else if (income >= RANK_THRESHOLDS.RANK_2) {
    return { rank: 2, maxReferrals: MAX_REFERRALS_BY_RANK[2] };
  } else {
    return { rank: 1, maxReferrals: MAX_REFERRALS_BY_RANK[1] };
  }
};

/**
 * Read referrers data from the JSON file
 */
const getAllReferrers = (): Promise<Referrer[]> => {
  return new Promise((resolve, reject) => {
    fs.readFile(DATA_FILE_PATH, 'utf8', (err, data) => {
      if (err) {
        reject(new Error(`Failed to read referrers data: ${err.message}`));
        return;
      }

      try {
        const referrers = JSON.parse(data) as Referrer[];
        resolve(referrers);
      } catch (error: any) {
        reject(new Error(`Failed to parse referrers data: ${error.message}`));
      }
    });
  });
};

/**
 * Write referrers data to the JSON file
 */
const writeReferrersData = (data: Referrer[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFile(DATA_FILE_PATH, jsonData, 'utf8', err => {
      if (err) {
        reject(new Error(`Failed to write referrers data: ${err.message}`));
        return;
      }
      resolve();
    });
  });
};

/**
 * Force refresh the referrers data
 */
const refreshReferrersData = async (): Promise<Referrer[]> => {
  // Clear the cache entry
  halfDayCache.delete('all-referrers');
  return await getAllReferrers();
};

/**
 * Generate a unique referral code
 */
const generateUniqueCode = (length: number = 6): string => {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing chars like 0/O, 1/I
  let code = '';
  
  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    code += characters.charAt(randomIndex);
  }
  
  return code;
};

/**
 * Generate initial codes for a new referrer
 */
const generateInitialCodes = async (count: number): Promise<string[]> => {
  const codes: string[] = [];
  const allReferrers = await getAllReferrers();
  const allExistingCodes = allReferrers.flatMap(r => r.unusedCodes);
  
  for (let i = 0; i < count; i++) {
    let newCode: string;
    let isUnique = false;
    
    // Keep generating until we get a unique code
    while (!isUnique) {
      newCode = generateUniqueCode();
      isUnique = !allExistingCodes.includes(newCode) && !codes.includes(newCode);
      
      if (isUnique) {
        codes.push(newCode);
      }
    }
  }
  
  return codes;
};

/**
 * Generate new referral codes for a referrer
 */
const generateNewCodes = async (
  address: string,
  count: number = 3
): Promise<{ success: boolean; codes: string[] }> => {
  // Get the referrer
  const referrer = await getReferrerByAddress(address);
  
  if (!referrer) {
    throw new Error(`Referrer with address ${address} not found`);
  }
  
  // Check if they already have the maximum number of codes
  // Maximum allowed is 2x their rank's max referrals
  const maxCodes = referrer.maxReferrals * 2;
  
  if (referrer.unusedCodes.length >= maxCodes) {
    throw new Error(`Referrer already has the maximum number of codes (${maxCodes})`);
  }
  
  // Calculate how many new codes we can generate
  const availableSlots = maxCodes - referrer.unusedCodes.length;
  const codesToGenerate = Math.min(count, availableSlots);
  
  // Generate unique codes
  const allReferrers = await getAllReferrers();
  const allExistingCodes = allReferrers.flatMap(r => r.unusedCodes);
  
  const newCodes: string[] = [];
  for (let i = 0; i < codesToGenerate; i++) {
    let newCode: string;
    let isUnique = false;
    
    // Keep generating until we get a unique code
    while (!isUnique) {
      newCode = generateUniqueCode();
      isUnique = !allExistingCodes.includes(newCode) && !newCodes.includes(newCode);
      
      if (isUnique) {
        newCodes.push(newCode);
      }
    }
  }
  
  // Update the referrer with new codes
  const referrerIndex = allReferrers.findIndex(r => 
    r.address.toLowerCase() === address.toLowerCase()
  );
  
  if (referrerIndex !== -1) {
    allReferrers[referrerIndex].unusedCodes = [
      ...allReferrers[referrerIndex].unusedCodes,
      ...newCodes
    ];
    
    // Save changes
    await writeReferrersData(allReferrers);
    
    // Refresh the cached data
    await refreshReferrersData();
  }
  
  return {
    success: true,
    codes: newCodes
  };
};

/**
 * Validate a referral code
 */
const validateReferralCode = async (code: string): Promise<{ 
  isValid: boolean; 
  referrer?: Referrer;
  message?: string;
}> => {
  // Get all referrers
  const referrers = await getAllReferrers();
  
  // Find the referrer with this code
  const referrer = referrers.find(r => 
    r.unusedCodes.some(c => c.toUpperCase() === code.toUpperCase())
  );
  
  if (!referrer) {
    return { 
      isValid: false, 
      message: 'Invalid or already used referral code' 
    };
  }
  
  // Check if referrer has reached maximum referrals
  if (referrer.referrals.length >= referrer.maxReferrals) {
    return { 
      isValid: false, 
      referrer,
      message: `Referrer has reached the maximum number of referrals (${referrer.maxReferrals})` 
    };
  }
  
  return { isValid: true, referrer };
};

/**
 * Add a new referrer
 */
const addReferrer = async (address: string, username: string): Promise<{ 
  success: boolean; 
  rank: number; 
  maxReferrals: number; 
  codes: string[] 
}> => {
  // Validate input
  if (!address || !username) {
    throw new Error('Address and username are required');
  }
  
  // Get existing referrers
  const referrers = await getAllReferrers();
  
  // Check if address or username already exist
  if (referrers.some(r => r.address.toLowerCase() === address.toLowerCase())) {
    throw new Error('Address already registered');
  }
  
  if (referrers.some(r => r.username.toLowerCase() === username.toLowerCase())) {
    throw new Error('Username already taken');
  }
  
  // Default to rank 1 for new referrers (can be refreshed later)
  const { rank, maxReferrals } = determineRank("0");
  
  // Generate initial codes based on rank
  const codes = await generateInitialCodes(maxReferrals);
  
  // Create new referrer object
  const newReferrer: Referrer = {
    address,
    username,
    SUPincome: "0",
    rank,
    maxReferrals,
    unusedCodes: codes,
    referrals: []
  };
  
  // Add to the list and save
  referrers.push(newReferrer);
  await writeReferrersData(referrers);
  
  // Refresh the cached data
  await refreshReferrersData();
  
  return { 
    success: true,
    rank, 
    maxReferrals, 
    codes 
  };
};

/**
 * Log a new referral
 */
const logReferral = async (
  referralAddress: string, 
  referrerCode: string
): Promise<{ success: boolean; message: string }> => {
  // Validate input
  if (!referralAddress || !referrerCode) {
    throw new Error('Referral address and referrer code are required');
  }
  
  // Get existing referrers
  const referrers = await getAllReferrers();
  
  // Find the referrer that has this code in their unusedCodes array
  const referrerIndex = referrers.findIndex(r => 
    r.unusedCodes.some(code => code.toUpperCase() === referrerCode.toUpperCase())
  );
  
  if (referrerIndex === -1) {
    throw new Error('Invalid or already used referrer code');
  }
  
  // Check if the referral is already in the system
  const isReferralAlreadyRegistered = referrers.some(r => 
    r.address.toLowerCase() === referralAddress.toLowerCase() ||
    r.referrals.some(ref => ref.address.toLowerCase() === referralAddress.toLowerCase())
  );
  
  if (isReferralAlreadyRegistered) {
    throw new Error('This address is already registered');
  }
  
  // Check if referrer has reached maximum referrals
  if (referrers[referrerIndex].referrals.length >= referrers[referrerIndex].maxReferrals) {
    throw new Error(`Referrer has reached the maximum number of referrals (${referrers[referrerIndex].maxReferrals})`);
  }
  
  // Find and remove the used code
  const codeIndex = referrers[referrerIndex].unusedCodes.findIndex(
    code => code.toUpperCase() === referrerCode.toUpperCase()
  );
  
  if (codeIndex !== -1) {
    referrers[referrerIndex].unusedCodes.splice(codeIndex, 1);
  }
  
  // Add the referral
  referrers[referrerIndex].referrals.push({
    address: referralAddress,
    SUPincome: "0"
  });
  
  // Save changes
  await writeReferrersData(referrers);
  
  // Refresh the cached data
  await refreshReferrersData();
  
  return { 
    success: true, 
    message: `Successfully added referral for ${referrers[referrerIndex].username}`
  };
};

/**
 * Get a specific referrer by address (with caching)
 */
const _getReferrerByAddress = async (address: string): Promise<Referrer | null> => {
  const referrers = await getAllReferrers();
  const referrer = referrers.find(r => r.address.toLowerCase() === address.toLowerCase());
  return referrer || null;
};

/**
 * Get a specific referrer by address (with caching via p-memoize)
 */
const getReferrerByAddress = pMemoize(_getReferrerByAddress, {
  cache: halfDayCache,
  cacheKey: ([address]) => `referrer-${address.toLowerCase()}`
});

/**
 * Fetch SUP income data for a specific address using the eligibility service
 * @param address Ethereum address to check
 * @returns Promise with the SUP income value in wei/s as a string
 */
const fetchSUPIncomeFromBlockchain = async (address: string): Promise<string> => {
  try {
    logger.info(`Fetching SUP income for address ${address} using eligibility service`);
    
    // Call the eligibility service directly with the address
    const eligibilityResults = await eligibilityService.checkEligibility([address]);
    
    // Extract the relevant data from the response
    if (eligibilityResults && eligibilityResults.length > 0) {
      const addressEligibility = eligibilityResults[0];
      const totalFlowRate = addressEligibility.totalFlowRate || "0";
      
      logger.info(`Fetched SUP income for ${address}: ${totalFlowRate} wei/s`);
      return totalFlowRate;
    } else {
      logger.info(`No eligibility data found for address ${address}, returning 0 income`);
      return "0";
    }
  } catch (error) {
    logger.error(`Failed to fetch SUP income for address ${address}`, { error });
    return "0";
  }
};

/**
 * Update SUP income for all referrers and their referrals
 */
const updateAllSUPIncomes = async (): Promise<void> => {
  try {
    logger.info('Starting batch update of all SUP incomes');
    
    // Get all referrers
    const referrers = await getAllReferrers();
    const updatedReferrers = [...referrers];
    
    // Process each referrer
    for (let i = 0; i < updatedReferrers.length; i++) {
      const referrer = updatedReferrers[i];
      
      // Update the referrer's own SUP income
      const referrerSUPIncome = await fetchSUPIncomeFromBlockchain(referrer.address);
      updatedReferrers[i].SUPincome = referrerSUPIncome;
      
      // Update rank and max referrals based on new income
      const { rank, maxReferrals } = determineRank(referrerSUPIncome);
      updatedReferrers[i].rank = rank;
      updatedReferrers[i].maxReferrals = maxReferrals;
      
      // Update each referral's SUP income
      for (let j = 0; j < referrer.referrals.length; j++) {
        const referralSUPIncome = await fetchSUPIncomeFromBlockchain(referrer.referrals[j].address);
        updatedReferrers[i].referrals[j].SUPincome = referralSUPIncome;
      }
      
      // Log progress periodically
      if ((i + 1) % 5 === 0 || i === updatedReferrers.length - 1) {
        logger.info(`Processed ${i + 1}/${updatedReferrers.length} referrers`);
      }
    }
    
    // Save the updated data
    await writeReferrersData(updatedReferrers);
    
    // Clear caches
    refreshReferrersData();
    
    logger.info('Successfully updated all SUP incomes');
  } catch (error) {
    logger.error('Failed to update all SUP incomes', { error });
    throw error;
  }
};

/**
 * Refresh data for a specific referrer
 */
const refreshReferrerData = async (address: string): Promise<Referrer | null> => {
  // Clear specific cache entries
  halfDayCache.delete(`referrer-${address.toLowerCase()}`);
  halfDayCache.delete('all-referrers');
  halfDayCache.delete('sorted-referrers');
  
  // Get the referrer data
  const referrer = await getReferrerByAddress(address);
  
  if (referrer) {
    // Get all referrers to update this one
    const referrers = await getAllReferrers();
    const referrerIndex = referrers.findIndex(r => 
      r.address.toLowerCase() === address.toLowerCase()
    );
    
    if (referrerIndex !== -1) {
      // Update the referrer's SUP income from blockchain
      const newSUPIncome = await fetchSUPIncomeFromBlockchain(address);
      referrers[referrerIndex].SUPincome = newSUPIncome;
      
      // Update rank and maxReferrals based on new SUP income
      const { rank, maxReferrals } = determineRank(newSUPIncome);
      referrers[referrerIndex].rank = rank;
      referrers[referrerIndex].maxReferrals = maxReferrals;
      
      // Update SUP income for each referral
      for (let i = 0; i < referrers[referrerIndex].referrals.length; i++) {
        const referral = referrers[referrerIndex].referrals[i];
        const referralSUPIncome = await fetchSUPIncomeFromBlockchain(referral.address);
        referrers[referrerIndex].referrals[i].SUPincome = referralSUPIncome;
      }
      
      // Save the changes
      await writeReferrersData(referrers);
      
      // Return the updated referrer
      return referrers[referrerIndex];
    }
  }
  
  return referrer;
};

/**
 * Get available referral codes for a referrer
 */
const getAvailableCodes = async (address: string): Promise<{
  success: boolean;
  codes: string[];
  rank: number;
  maxReferrals: number;
  currentReferrals: number;
}> => {
  const referrer = await getReferrerByAddress(address);
  
  if (!referrer) {
    throw new Error('Referrer not found');
  }
  
  return {
    success: true,
    codes: referrer.unusedCodes,
    rank: referrer.rank,
    maxReferrals: referrer.maxReferrals,
    currentReferrals: referrer.referrals.length
  };
};

/**
 * Sort referrers by total SUPincome of their referrals
 */
const _getSortedReferrers = async (): Promise<Referrer[]> => {
  const referrers = await getAllReferrers();
  
  // Calculate total SUPincome for each referrer's referrals
  return referrers.sort((a, b) => {
    const aTotalSUPincome = a.referrals.reduce(
      (sum, referral) => sum + BigInt(referral.SUPincome), 
      BigInt(0)
    );
    
    const bTotalSUPincome = b.referrals.reduce(
      (sum, referral) => sum + BigInt(referral.SUPincome), 
      BigInt(0)
    );
    
    return bTotalSUPincome > aTotalSUPincome ? 1 : -1;
  });
};

/**
 * Get sorted referrers (with caching via p-memoize)
 */
const getSortedReferrers = pMemoize(_getSortedReferrers, {
  cache: halfDayCache,
  cacheKey: () => 'sorted-referrers'
});

// Export all the functions that should be available to other modules
export {
  getAllReferrers,
  getSortedReferrers,
  getReferrerByAddress,
  addReferrer,
  logReferral,
  refreshReferrerData,
  refreshReferrersData,
  generateNewCodes,
  getAvailableCodes,
  updateAllSUPIncomes,
  validateReferralCode
}; 