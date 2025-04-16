export interface Referral {
  address: string;
  SUPincome: string;
}

export interface Referrer {
  address: string;
  username: string;
  SUPincome: string;
  rank: number;
  maxReferrals: number;
  unusedCodes: string[];
  referrals: Referral[];
}

export interface LeaderboardReferrer extends Referrer {
  referralCount: number;
  totalReferralSUPincome: string;
  avgReferralSUPincome: string;
}

export interface LeaderboardResponse {
  success: boolean;
  data: LeaderboardReferrer[];
}

export interface ReferrerResponse {
  success: boolean;
  data: LeaderboardReferrer;
}

export interface AddReferrerRequest {
  address: string;
  discordUsername: string;
}

export interface AddReferrerResponse {
  success: boolean;
  rank?: number;
  maxReferrals?: number;
  codes?: string[];
  message?: string;
}

export interface LogReferralRequest {
  referralAddress: string;
  referrerCode: string;
}

export interface LogReferralResponse {
  success: boolean;
  message: string;
}

export interface RefreshResponse {
  success: boolean;
  message?: string;
  data?: LeaderboardReferrer;
}

export interface CodeResponse {
  success: boolean;
  codes: string[];
  rank: number;
  maxReferrals: number;
  currentReferrals: number;
} 