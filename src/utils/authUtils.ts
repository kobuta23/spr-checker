import crypto from 'crypto';

/**
 * Generate a secure, random authentication code
 * @param length The length of the code to generate (default: 12)
 * @returns A secure random authentication code
 */
export const generateAuthCode = (length: number = 12): string => {
  // Create a secure random string with a mix of characters
  const buffer = crypto.randomBytes(Math.ceil(length * 0.75));
  
  // Convert to a base64 string and remove non-alphanumeric characters
  const code = buffer.toString('base64')
    .replace(/[+/=]/g, '')  // Remove non-URL-safe characters
    .slice(0, length);       // Trim to desired length
  
  return code;
};

/**
 * Generate a session token for authenticated users
 * @returns A secure session token
 */
export const generateSessionToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
}; 