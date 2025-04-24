/// <reference types="jest" />

import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';
import { describe, it, expect } from "@jest/globals";
// This will be provided by the user
const BASE_URL = process.env.BASE_URL || 'http://localhost:9900/api';

describe('Referral System End-to-End Tests', () => {
  // Generate unique addresses for testing
  const generateAddress = (): string => {
    // Create a deterministic but random-looking Ethereum address
    return `0x${uuidv4().replace(/-/g, '').substring(0, 40)}`;
  };

  // Create random usernames
  const generateUsername = (): string => {
    return `tester_${Math.floor(Math.random() * 10000)}`;
  };

  // Store test data
  const testReferrers: Array<{ address: string; username: string; discordId?: string }> = [];
  const referralCodes: string[] = [];
  const testReferrals: Array<{ address: string; referralCode: string }> = [];

  it('should add multiple referrers', async () => {
    // Create 3 test referrers
    for (let i = 0; i < 3; i++) {
      const referrer = {
        address: generateAddress(),
        username: generateUsername(),
        discordId: `discord_${Math.floor(Math.random() * 1000000000)}`
      };
      testReferrers.push(referrer);

      try {
        // Add the referrer through the API
        const response = await axios.post(`${BASE_URL}/referrals/log-referral`, {
          referrerAddress: referrer.address,
          referrerUsername: referrer.username,
          discordId: referrer.discordId
        });

        console.log(`Added referrer: ${referrer.username} (${referrer.address})`);
        expect(response.status).toBe(201);
        expect(response.data.success).toBe(true);
      } catch (error: any) {
        console.error(`Failed to add referrer ${referrer.username}:`, error.response?.data || error.message);
        throw error;
      }
    }

    // Verify we have added all referrers
    expect(testReferrers.length).toBe(3);
  });

  it('should get referral codes for each referrer', async () => {
    // For each referrer, get their referral codes
    for (const referrer of testReferrers) {
      try {
        // Get referrer data including codes
        const response = await axios.get(`${BASE_URL}/referrals/${referrer.address}`);
        
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        
        // Store one code from each referrer for testing
        const { unusedCodes } = response.data.data;
        expect(unusedCodes.length).toBeGreaterThan(0);
        
        const code = unusedCodes[0];
        referralCodes.push(code);
        console.log(`Got referral code for ${referrer.username}: ${code}`);
      } catch (error: any) {
        console.error(`Failed to get codes for ${referrer.address}:`, error.response?.data || error.message);
        throw error;
      }
    }

    // Verify we have codes for all referrers
    expect(referralCodes.length).toBe(testReferrers.length);
  });

  it('should log referrals using the referral codes', async () => {
    // For each referral code, create a new referral
    for (const code of referralCodes) {
      const referral = {
        address: generateAddress(),
        referralCode: code
      };
      testReferrals.push(referral);

      try {
        // Log the referral through the API
        const response = await axios.post(`${BASE_URL}/referrals/log-referral`, {
          referralAddress: referral.address,
          referralCode: referral.referralCode
        });

        console.log(`Added referral: ${referral.address} using code ${code}`);
        expect(response.status).toBe(201);
        expect(response.data.success).toBe(true);
        
        // The response should include the referrer information
        expect(response.data.referrer).toBeDefined();
      } catch (error: any) {
        console.error(`Failed to log referral with code ${code}:`, error.response?.data || error.message);
        throw error;
      }
    }

    // Verify we have created all referrals
    expect(testReferrals.length).toBe(referralCodes.length);
  });

  it('should verify the referral relationships', async () => {
    // For each referrer, verify their referrals are correctly tracked
    for (const referrer of testReferrers) {
      try {
        // Get referrer data including referrals
        const response = await axios.get(`${BASE_URL}/referrals/${referrer.address}`);
        
        expect(response.status).toBe(200);
        expect(response.data.success).toBe(true);
        
        const { referrals } = response.data.data;
        
        // Find the referral we created using this referrer's code
        const referrerCode = referralCodes[testReferrers.indexOf(referrer)];
        const createdReferral = testReferrals.find(r => r.referralCode === referrerCode);
        
        // Verify the referral exists in the referrer's data
        const foundReferral = referrals.find((r: any) => r.address.toLowerCase() === createdReferral?.address.toLowerCase());
        expect(foundReferral).toBeDefined();
        
        console.log(`Verified referral relationship: ${referrer.address} -> ${createdReferral?.address}`);
      } catch (error: any) {
        console.error(`Failed to verify referrals for ${referrer.address}:`, error.response?.data || error.message);
        throw error;
      }
    }
  });

  it('should check the leaderboard for our test referrers', async () => {
    try {
      // Get the leaderboard data
      const response = await axios.get(`${BASE_URL}/referrals`);
      
      expect(response.status).toBe(200);
      expect(response.data.success).toBe(true);
      
      // Find our test referrers in the leaderboard
      for (const referrer of testReferrers) {
        const foundReferrer = response.data.data.find(
          (r: any) => r.address.toLowerCase() === referrer.address.toLowerCase()
        );
        
        expect(foundReferrer).toBeDefined();
        expect(foundReferrer.referralCount).toBeGreaterThanOrEqual(1);
        
        console.log(`Found ${referrer.username} in leaderboard with ${foundReferrer.referralCount} referrals`);
      }
    } catch (error: any) {
      console.error('Failed to check leaderboard:', error.response?.data || error.message);
      throw error;
    }
  });
});
