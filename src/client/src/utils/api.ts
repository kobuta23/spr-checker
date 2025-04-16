import axios from 'axios';
import {
  LeaderboardResponse,
  ReferrerResponse,
  AddReferrerRequest,
  AddReferrerResponse,
  LogReferralRequest,
  LogReferralResponse,
  RefreshResponse
} from '../types/referralTypes';

// API base URL with /api prefix
const API_BASE = '/api';

// Referral API endpoints
export const referralApi = {
  // Get the leaderboard data
  getLeaderboard: async (): Promise<LeaderboardResponse> => {
    try {
      const response = await axios.get(`${API_BASE}/referrals`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get a specific referrer's data
  getReferrer: async (address: string): Promise<ReferrerResponse> => {
    try {
      const response = await axios.get(`${API_BASE}/referrals/${address}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Add a new referrer
  addReferrer: async (data: AddReferrerRequest): Promise<AddReferrerResponse> => {
    try {
      const response = await axios.post(`${API_BASE}/referrals/add-referrer`, data);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Log a referral
  logReferral: async (data: LogReferralRequest): Promise<LogReferralResponse> => {
    try {
      const response = await axios.post(`${API_BASE}/referrals/log-referral`, data);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Get available referral codes for a user
  getAvailableCodes: async (address: string): Promise<{ success: boolean; codes: string[] }> => {
    try {
      const response = await axios.get(`${API_BASE}/referrals/codes/${address}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Generate new referral codes for a user
  generateCodes: async (address: string): Promise<{ success: boolean; codes: string[] }> => {
    try {
      const response = await axios.post(`${API_BASE}/referrals/generate-codes/${address}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Refresh a referrer's data
  refreshReferrer: async (address: string): Promise<RefreshResponse> => {
    try {
      const response = await axios.post(`${API_BASE}/referrals/refresh/${address}`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Update Discord leaderboard
  updateDiscord: async (): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await axios.post(`${API_BASE}/referrals/update-discord`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  },

  // Update SUP income for all referrers
  updateSUPIncome: async (): Promise<{ success: boolean; message: string }> => {
    try {
      const response = await axios.post(`${API_BASE}/referrals/update-sup-income`);
      return response.data;
    } catch (error) {
      throw handleApiError(error);
    }
  }
};

// Helper function to handle API errors
function handleApiError(error: any): Error {
  if (axios.isAxiosError(error) && error.response) {
    // Extract the error message from the API response
    const errorMessage = error.response.data?.message || 'An error occurred';
    return new Error(errorMessage);
  }
  return error instanceof Error ? error : new Error('An unexpected error occurred');
} 