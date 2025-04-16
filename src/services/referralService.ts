import fs from 'fs';
import path from 'path';
import pMemoize from 'p-memoize';
import { halfDayCache } from '../config/cache';
import logger from '../utils/logger';
import config from '../config';
import blockchainService from './blockchain/blockchainService';

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
const readReferrersData = (): Promise<Referrer[]> => {
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
 * Internal function to get all referrers data
 */
const _getAllReferrers = async (): Promise<Referrer[]> => {
  return await readReferrersData();
};

/**
 * Get all referrers data (with caching via p-memoize)
 */
const getAllReferrers = pMemoize(_getAllReferrers, {
  cache: halfDayCache,
  cacheKey: () => 'all-referrers'
});

/**
 * Force refresh the referrers data
 */
const refreshReferrersData = async (): Promise<Referrer[]> => {
  // Clear the cache entry
  halfDayCache.delete('all-referrers');
  return await getAllReferrers();
};

/**
 * Generate a unique one-time use referral code
 */
const generateUniqueCode = async (): Promise<string> => {
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  let code: string;
  
  // Get existing codes from all referrers
  const referrers = await getAllReferrers();
  const existingCodes = new Set<string>();
  
  // Collect all used and unused codes
  referrers.forEach(referrer => {
    referrer.unusedCodes.forEach(code => existingCodes.add(code));
  });
  
  // Generate a unique code
  do {
    code = Array(6)
      .fill(0)
      .map(() => characters.charAt(Math.floor(Math.random() * characters.length)))
      .join('');
  } while (existingCodes.has(code));
  
  return code;
};

/**
 * Generate multiple unique codes based on count
 */
const generateCodes = async (count: number): Promise<string[]> => {
  const codes: string[] = [];
  
  for (let i = 0; i < count; i++) {
    codes.push(await generateUniqueCode());
  }
  
  return codes;
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
  const codes = await generateCodes(maxReferrals);
  
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
 * Fetch SUP income data from the blockchain for a specific address
 * @param address Ethereum address to check
 * @returns Promise with the SUP income value in wei/s as a string
 */
const fetchSUPIncomeFromBlockchain = async (address: string): Promise<string> => {
  try {
    logger.info(`Fetching SUP income from blockchain for address ${address}`);
    
    // Get the locker address if available
    const lockerAddresses = await blockchainService.getLockerAddresses([address]);
    const lockerAddress = lockerAddresses.get(address);
    
    if (!lockerAddress) {
      logger.info(`No locker found for address ${address}, returning 0 income`);
      return "0";
    }
    
    // Initialize total income
    let totalIncome = BigInt(0);
    
    // Check each GDA pool for income
    for (const { gdaPoolAddress } of config.pointSystems) {
      try {
        // Get units for this address in this pool
        const memberUnits = await blockchainService.checkClaimStatus(lockerAddress, gdaPoolAddress);
        
        // Get total units in the pool
        const totalUnits = await blockchainService.getTotalUnits(gdaPoolAddress);
        
        // If there are units and this user has some, calculate their share of the pool's income
        if (totalUnits > BigInt(0) && memberUnits > BigInt(0)) {
          // This is a simplified calculation and would need to be adjusted based on 
          // the actual token economics of the system
          const poolFlowRate = BigInt("1000000000000000"); // Example: 0.001 SUP/s for the pool
          const userFlowRate = (memberUnits * poolFlowRate) / totalUnits;
          totalIncome += userFlowRate;
        }
      } catch (error) {
        logger.error(`Error getting income from pool ${gdaPoolAddress} for address ${address}`, { error });
      }
    }
    
    logger.info(`Fetched SUP income for ${address}: ${totalIncome.toString()} wei/s`);
    return totalIncome.toString();
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
 * Generate new referral codes for a referrer
 */
const generateNewCodes = async (address: string): Promise<{
  success: boolean;
  codes: string[];
  rank: number;
  maxReferrals: number;
  currentReferrals: number;
}> => {
  // Get the referrer data
  const referrer = await getReferrerByAddress(address);
  
  if (!referrer) {
    throw new Error('Referrer not found');
  }
  
  // Calculate how many codes they can have
  const maxCodesAllowed = referrer.maxReferrals - referrer.referrals.length;
  const currentUnusedCount = referrer.unusedCodes.length;
  
  if (currentUnusedCount >= maxCodesAllowed) {
    throw new Error(`You already have the maximum number of unused codes (${currentUnusedCount})`);
  }
  
  // Generate new codes up to the maximum allowed
  const newCodesCount = maxCodesAllowed - currentUnusedCount;
  const newCodes = await generateCodes(newCodesCount);
  
  // Update the referrer with new codes
  const referrers = await getAllReferrers();
  const referrerIndex = referrers.findIndex(r => 
    r.address.toLowerCase() === address.toLowerCase()
  );
  
  if (referrerIndex !== -1) {
    referrers[referrerIndex].unusedCodes = [
      ...referrers[referrerIndex].unusedCodes,
      ...newCodes
    ];
    
    // Save the changes
    await writeReferrersData(referrers);
    
    // Refresh the data
    await refreshReferrersData();
    
    return {
      success: true,
      codes: referrers[referrerIndex].unusedCodes,
      rank: referrer.rank,
      maxReferrals: referrer.maxReferrals,
      currentReferrals: referrer.referrals.length
    };
  }
  
  throw new Error('Failed to generate new codes');
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
  updateAllSUPIncomes
}; 