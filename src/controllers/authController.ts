import { validateAuthCode } from '../services/authService';
import { generateSessionToken } from '../utils/authUtils';
import logger from '../utils/logger';

/**
 * Validate an authentication code and return a session token if valid
 * @param code The authentication code to validate
 * @returns Object with success status, message, and session token if successful
 */
export const validateCode = async (code: string): Promise<{
  success: boolean;
  message: string;
  token?: string;
  username?: string;
}> => {
  try {
    // Validate the auth code
    const admin = await validateAuthCode(code);
    
    if (!admin) {
      logger.info(`Failed authentication attempt with code: ${code}`);
      return {
        success: false,
        message: 'Invalid authentication code'
      };
    }
    
    // Generate a session token
    const token = generateSessionToken();
    
    logger.info(`Successful authentication for admin: ${admin.username} (${admin.discordId})`);
    
    return {
      success: true,
      message: 'Authentication successful',
      token,
      username: admin.username
    };
  } catch (error) {
    logger.error('Error validating authentication code', { error });
    return {
      success: false,
      message: 'An error occurred during authentication'
    };
  }
}; 