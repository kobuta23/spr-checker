export const REFERRAL_REWARD = 249;

/**
 * Level System Configuration
 * This file serves as the single source of truth for level thresholds and related settings
 */

export type Levels = 1 | 2 | 3 | 4;

// SUP income thresholds for levels (in wei/s)
export const LEVEL_THRESHOLDS: Record<Levels, bigint> = {
  // For referrals: 350 SUP/month = 350 / (30 * 24 * 60 * 60) SUP/s = ~0.000135 SUP/s
  // 0.000135 SUP/s * 10^18 = 135000000000000 wei/s per referral
  // For user: 1000 SUP/month = 1000 / (30 * 24 * 60 * 60) SUP/s = ~0.000386 SUP/s
  // 0.000386 SUP/s * 10^18 = 386000000000000 wei/s base requirement
  4: BigInt("3086000000000000"), // (20 * 135000000000000) + 386000000000000
  3: BigInt("1736000000000000"), // (10 * 135000000000000) + 386000000000000
  2: BigInt("1061000000000000"), // (5 * 135000000000000) + 386000000000000
  1: BigInt("0")   // Base requirement only
};

// Max referrals per level
export const MAX_REFERRALS_BY_LEVEL: Record<Levels, number> = {
  4: 20, // Level 4: 20 max referrals
  3: 10, // Level 3: 10 max referrals
  2: 5,  // Level 2: 5 max referrals
  1: 3   // Level 1: 3 max referrals
};

export const REWARDS_FOR_LEVEL_UP: Record<Levels, number> = {
  4: 30000, // 1500 points per referral
  3: 15000, // 1500 points per referral
  2: 7500, // 1500 points per referral
  1: 4500 // 1500 points per referral
};

function makeDescription(lvl: Levels): string {
    return `Level ${lvl}: ≥ ${(Number(LEVEL_THRESHOLDS[lvl]) / 10**18).toFixed(4)} SUP/s (${MAX_REFERRALS_BY_LEVEL[lvl]} max refs)`;
}

// Human-readable level descriptions for display
export const LEVEL_DESCRIPTIONS: Record<Levels, string> = {
  1: makeDescription(1),
  2: makeDescription(2),
  3: makeDescription(3),
  4: makeDescription(4)
};

// Level emojis for Discord display
export const LEVEL_EMOJIS: Record<Levels, string> = {
  1: '⭐', // Level 1: Star
  2: '🥉', // Level 2: Bronze
  3: '🥈', // Level 3: Silver
  4: '🥇'  // Level 4: Gold
}; 