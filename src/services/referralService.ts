import fs from 'fs';
import path from 'path';
import pMemoize from 'p-memoize';
import { halfDayCache } from '../config/cache';
import logger from '../utils/logger';
import config from '../config';
import blockchainService from './blockchain/blockchainService';
import axios from 'axios';
import eligibilityService from './eligibilityService';
import * as discordService from './discord';
import { LEVEL_THRESHOLDS, MAX_REFERRALS_BY_LEVEL, Levels, REWARDS_FOR_LEVEL_UP, REFERRAL_REWARD } from '../config/levels';
import stackApiService from './stack/stackApiService';

// Types
interface Referral {
  address: string;
  SUPincome: string;
}

export interface Referrer {
  address: string;
  username: string;
  discordId: string;
  SUPincome: string;
  level: Levels;
  maxReferrals: number;
  unusedCodes: string[];
  referrals: Referral[];
}

// Path to the JSON data file
const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'referrals.json');

/**
 * Add this initialization function near the top of the file
 */
const initializeDataFile = async (): Promise<void> => {
  const dataDir = path.join(process.cwd(), 'data');
  
  // Check if data directory exists, create if not
  if (!fs.existsSync(dataDir)) {
    await fs.promises.mkdir(dataDir, { recursive: true });
    logger.info(`Created data directory at ${dataDir}`);
  }
  
  // Check if referrals.json exists, create empty array if not
  if (!fs.existsSync(DATA_FILE_PATH)) {
    await fs.promises.writeFile(DATA_FILE_PATH, JSON.stringify([], null, 2), 'utf8');
    logger.info(`Created empty referrals file at ${DATA_FILE_PATH}`);
  }
};

/**
 * Determine level and max referrals based on total SUP income (user + referrals)
 * @param userIncome The user's own SUP income as a string
 * @param referrals Optional array of referrals with their income
 * @returns Object containing the calculated level and maxReferrals
 */
const refreshLevel = async (user: Referrer): Promise<Referrer> => {
  // Sum up all referral incomes
  const totalReferralIncome = user.referrals.reduce(
    (sum, referral) => sum + BigInt(referral.SUPincome), 
    BigInt(0)
  );
  
  // Total income is user's income plus all referral income
  const totalIncome = BigInt(user.SUPincome) + totalReferralIncome;
  let newLevel: Levels = totalIncome >= LEVEL_THRESHOLDS[4] ? 4 : totalIncome >= LEVEL_THRESHOLDS[3] ? 3 : totalIncome >= LEVEL_THRESHOLDS[2] ? 2 : 1;
  let newMaxReferrals = MAX_REFERRALS_BY_LEVEL[newLevel];
  const {codes} = await refreshCodes(user);
  if (newLevel > user.level) {
    for (let i = user.level; i < newLevel; i++) {
      stackApiService.assignPoints(user.address, REWARDS_FOR_LEVEL_UP[i], `completed_level_${i}`);
    }
  }
  // assign the level and max referrals to the user
  return {...user, level: newLevel, maxReferrals: newMaxReferrals, unusedCodes: codes };
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
const generateCodes = async (count: number, allReferrers: Referrer[]): Promise<string[]> => {
  const codes: string[] = [];
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
const refreshCodes = async (
  referrer: Referrer
): Promise<{ success: boolean; codes: string[] }> => {
  // Check if they already have the maximum number of codes
  // Maximum allowed is their level's max referrals
  const maxCodes = referrer.maxReferrals;

  if (referrer.unusedCodes.length >= maxCodes) {
    return {
      success: true,
      codes: referrer.unusedCodes
    };
  }
  
  // Calculate how many new codes we can generate
  const codesToGenerate = maxCodes - referrer.unusedCodes.length - referrer.referrals.length;
  console.log(`the user can generate a maximum of ${maxCodes} codes`);
  console.log(`the user has ${referrer.unusedCodes.length} unused codes`);
  console.log(`the user has ${referrer.referrals.length} referrals`);
  console.log(`the user can generate ${codesToGenerate} new codes`);
  // Generate unique codes
  const allReferrers = await getAllReferrers();

  const newCodes: string[] = await generateCodes(codesToGenerate, allReferrers);

  console.log("newCodes: ", newCodes);
  // Update the referrer with new codes
  const referrerIndex = allReferrers.findIndex(r => 
    r.address.toLowerCase() === referrer.address.toLowerCase()
  );
   
  if (referrerIndex !== -1) {
    allReferrers[referrerIndex].unusedCodes = [
      ...allReferrers[referrerIndex].unusedCodes,
      ...newCodes
    ];
    
    // Save changes
    await writeReferrersData(allReferrers);
  }
  
  return {
    success: true,
    codes: [...newCodes, ...referrer.unusedCodes]
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
const addReferrer = async (address: string, username: string, discordId: string): Promise<{ 
  success: boolean; 
  level: number; 
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
  // Create new referrer object
  const newReferrer: Referrer = {
    address,
    username,
    discordId,
    SUPincome: "0",
    level: 1,
    maxReferrals: 3 ,
    unusedCodes: [],
    referrals: []
  };
  
  // Default to level 1 for new referrers (can be refreshed later)
  const { level, maxReferrals, unusedCodes } = await refreshLevel(newReferrer);
  // Generate initial codes based on level  
  
  // Add to the list and save
  referrers.push(newReferrer);
  await writeReferrersData(referrers);
  // specifically don't wait for this to finish
  refreshReferrerData(address);

  return { 
    success: true,
    level, 
    maxReferrals, 
    codes: unusedCodes
  };
};

/**
 * Log a new referral
 */
const logReferral = async (
  referralAddress: string, 
  referrerCode: string
): Promise<{ success: boolean; message: string; referrer?: Referrer }> => {
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
  stackApiService.assignPoints(referralAddress, REFERRAL_REWARD, "referral_reward");
  // Save changes
  await writeReferrersData(referrers);
  
  return { 
    success: true, 
    referrer: referrers[referrerIndex],
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
 * Get a specific referrer by address (with caching)
 */
const getReferrerByDiscordId = async (discordId: string): Promise<Referrer | null> => {
    let referrers: Referrer[] = [];
    try {
        referrers = await getAllReferrers();
    } catch (error) {
        logger.error('Error getting all referrers in getReferrerByDiscordId', { error });
        return null;
    }
    try {
        console.log("referrers: ", referrers);
        const referrer = referrers.find(r => r.discordId.toLowerCase() === discordId.toLowerCase());
        return referrer || null;
    } catch (error) {
        logger.error('Error getting referrer by discord id', { error });
        return null;
    }
  };
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
      
      // Update level and max referrals based on new income
      const { level, maxReferrals } = await refreshLevel(referrer);
      updatedReferrers[i].level = level;
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
  halfDayCache.delete('sorted-referrers');
  
  // Get the referrer data
  const referrer = await getReferrerByAddress(address);
  
  if (referrer) {
    // Get all referrers to update this one
    const referrers = await getAllReferrers();
    const referrerIndex = referrers.findIndex(r => 
      r.address.toLowerCase() === address.toLowerCase()
    );
    
      // Update the referrer's SUP income from blockchain
      const newSUPIncome = await fetchSUPIncomeFromBlockchain(address);
      referrers[referrerIndex].SUPincome = newSUPIncome;
      
      // Update level and maxReferrals based on new SUP income
      const { level, maxReferrals } = await refreshLevel(referrers[referrerIndex]);
      referrers[referrerIndex].level = level;
      referrers[referrerIndex].maxReferrals = maxReferrals;
      
      // Update SUP income for each referral
      for (let i = 0; i < referrer.referrals.length; i++) {
        const referral = referrer.referrals[i];
        const referralSUPIncome = await fetchSUPIncomeFromBlockchain(referral.address);
        referrers[referrerIndex].referrals[i].SUPincome = referralSUPIncome;
      }
      
      // Save the changes
      await writeReferrersData(referrers);
      await discordService.postLeaderboard(referrers);
      // Return the updated referrer
      return referrers[referrerIndex];
  }     
  return null;
};

/**
 * Get available referral codes for a referrer
 */
const getAvailableCodes = async (referrer: Referrer): Promise<{
  success: boolean;
  codes: string[];
  level: number;
  maxReferrals: number;
  currentReferrals: number;
}> => {
    if (!referrer) {
        throw new Error('Referrer not found');
    }
    let codes: string[] = [];
    try {
        const result = await refreshCodes(referrer);
        codes = result.codes;
        console.log("inside getAvailableCodes, codes: ", codes);
    } catch (error) {
        logger.error('Error refreshing codes', { error });
        throw error;
    }
  
    return {
        success: true,
        codes,
        level: referrer.level,
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

const getReferrerCodesByAddress = async (address: string): Promise<Referrer | null> => {
    let referrer = await getReferrerByAddress(address);
    
    if (referrer) {
      const refreshedReferrer = await refreshReferrerData(referrer.address);
      if (refreshedReferrer) {
        referrer = refreshedReferrer;
        const {codes} = await refreshCodes(referrer);
        referrer.unusedCodes = codes;
      }
    }
    return referrer;
};

const postLeaderboard = async (refresh: boolean = false): Promise<void> => {
    if (refresh) {
        await updateAllSUPIncomes();
    }
    // Update Discord leaderboard after updating incomes
    try {
      const allReferrers = await getSortedReferrers();
      await discordService.postLeaderboard(allReferrers);
    } catch (discordError) {
      logger.error('Failed to update Discord leaderboard after SUP income update', { error: discordError });
      // Don't fail the request if Discord update fails
    }
};

/**
 * Calculate derived values for a referrer and return enriched data
 */
const getEnrichedReferrerData = (referrer: Referrer) => {
  // Calculate total SUPincome of referred users
  const totalSUPincome = referrer.referrals.reduce(
    (sum, referral) => sum + BigInt(referral.SUPincome),
    BigInt(0)
  ).toString();
  
  // Calculate average SUPincome (if there are referrals)
  const avgSUPincome = referrer.referrals.length > 0
    ? (BigInt(totalSUPincome) / BigInt(referrer.referrals.length)).toString()
    : "0";
  
  // Sort referrals by SUPincome
  const sortedReferrals = [...referrer.referrals].sort((a, b) => {
    return BigInt(b.SUPincome) > BigInt(a.SUPincome) ? 1 : -1;
  });
  
  return {
    address: referrer.address,
    username: referrer.username,
    SUPincome: referrer.SUPincome,
    level: referrer.level,
    maxReferrals: referrer.maxReferrals,
    referralCount: referrer.referrals.length,
    unusedCodes: referrer.unusedCodes,
    totalReferralSUPincome: totalSUPincome,
    avgReferralSUPincome: avgSUPincome,
    referrals: sortedReferrals
  };
};
initializeDataFile()
// Export all the functions that should be available to other modules
export {
  getAllReferrers,
  getSortedReferrers,
  getReferrerByAddress,
  getReferrerByDiscordId,
  addReferrer,
  logReferral,
  refreshReferrerData,
  refreshCodes,
  getAvailableCodes,
  updateAllSUPIncomes,
  validateReferralCode,
  getReferrerCodesByAddress,
  postLeaderboard,
  getEnrichedReferrerData
}; 