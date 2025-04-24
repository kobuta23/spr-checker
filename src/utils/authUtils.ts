import crypto from 'crypto';

// Get the UI base URL from environment or use a default
const UI_BASE_URL = process.env.UI_BASE_URL || 'https://superfluid-eligibility-api.s.superfluid.dev/';

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

/**
 * Generate a UI access link with embedded auth code
 * @param authCode The authentication code to embed in the link
 * @returns A fully formatted deep link to the UI with the auth code
 */
export const generateUILink = (authCode: string): string => {
  // Create URL object for proper encoding
  const url = new URL(UI_BASE_URL);
  
  // Add the code as a query parameter
  url.searchParams.append('code', authCode);
  
  // Return the formatted URL as a string
  return url.toString();
}; 