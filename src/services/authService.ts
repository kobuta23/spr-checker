import fs from 'fs';
import path from 'path';
import logger from '../utils/logger';
import { generateAuthCode } from '../utils/authUtils';

// Define the Admin interface
export interface Admin {
  discordId: string;
  username: string;
  authCode: string;
  createdAt: string;
}

// Path to the admins data file
const ADMINS_FILE_PATH = path.join(process.cwd(), 'data', 'admins.json');

// Initialize the admins file if it doesn't exist
const initializeAdminsFile = (): void => {
  try {
    const dataDir = path.join(process.cwd(), 'data');
    
    // Create data directory if it doesn't exist
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
      logger.info(`Created data directory at ${dataDir}`);
    }
    
    // Create empty admins file if it doesn't exist
    if (!fs.existsSync(ADMINS_FILE_PATH)) {
      fs.writeFileSync(ADMINS_FILE_PATH, JSON.stringify([], null, 2), 'utf8');
      logger.info(`Created empty admins file at ${ADMINS_FILE_PATH}`);
    }
  } catch (error) {
    logger.error('Failed to initialize admins file', { error });
  }
};

// Call the initialization function when the module loads
initializeAdminsFile();

/**
 * Get all admin users from the JSON file
 */
const getAllAdmins = async (): Promise<Admin[]> => {
  return new Promise((resolve, reject) => {
    fs.readFile(ADMINS_FILE_PATH, 'utf8', (err, data) => {
      if (err) {
        reject(new Error(`Failed to read admins data: ${err.message}`));
        return;
      }

      try {
        const admins = JSON.parse(data) as Admin[];
        resolve(admins);
      } catch (error: any) {
        reject(new Error(`Failed to parse admins data: ${error.message}`));
      }
    });
  });
};

/**
 * Write admins data to the JSON file
 */
const writeAdminsData = async (data: Admin[]): Promise<void> => {
  return new Promise((resolve, reject) => {
    const jsonData = JSON.stringify(data, null, 2);
    fs.writeFile(ADMINS_FILE_PATH, jsonData, 'utf8', err => {
      if (err) {
        reject(new Error(`Failed to write admins data: ${err.message}`));
        return;
      }
      resolve();
    });
  });
};

/**
 * Check if a Discord user is already registered as an admin
 */
const isDiscordUserRegistered = async (discordId: string): Promise<boolean> => {
  try {
    const admins = await getAllAdmins();
    return admins.some(admin => admin.discordId === discordId);
  } catch (error) {
    logger.error(`Error checking if Discord user ${discordId} is registered`, { error });
    throw error;
  }
};

/**
 * Add a new admin with a generated auth code
 */
const addAdmin = async (discordId: string, username: string): Promise<Admin> => {
  try {
    // Check if user is already registered
    const isRegistered = await isDiscordUserRegistered(discordId);
    if (isRegistered) {
      throw new Error(`Discord user ${discordId} is already registered as an admin`);
    }

    // Get all admins
    const admins = await getAllAdmins();
    
    // Generate a unique auth code
    const authCode = generateAuthCode();
    
    // Create new admin
    const newAdmin: Admin = {
      discordId,
      username,
      authCode,
      createdAt: new Date().toISOString()
    };
    
    // Add to the list and save
    admins.push(newAdmin);
    await writeAdminsData(admins);
    
    logger.info(`Added new admin: ${username} (${discordId})`);
    return newAdmin;
  } catch (error) {
    logger.error(`Error adding admin ${username} (${discordId})`, { error });
    throw error;
  }
};

/**
 * Validate an auth code
 */
const validateAuthCode = async (authCode: string): Promise<Admin | null> => {
  try {
    const admins = await getAllAdmins();
    const admin = admins.find(admin => admin.authCode === authCode);
    return admin || null;
  } catch (error) {
    logger.error(`Error validating auth code`, { error });
    throw error;
  }
};

/**
 * Get an admin by Discord ID
 */
const getAdminByDiscordId = async (discordId: string): Promise<Admin | null> => {
  try {
    const admins = await getAllAdmins();
    const admin = admins.find(admin => admin.discordId === discordId);
    return admin || null;
  } catch (error) {
    logger.error(`Error getting admin by Discord ID ${discordId}`, { error });
    throw error;
  }
};

export {
  getAllAdmins,
  isDiscordUserRegistered,
  addAdmin,
  validateAuthCode,
  getAdminByDiscordId
}; 