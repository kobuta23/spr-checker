import { oneWeekCache } from '../src/config/cache';

// Add this function to explicitly clear the cache
export const clearProfileCache = () => {
  oneWeekCache.clear();
  console.log('Profile cache cleared successfully');
};

// Execute if run directly
if (require.main === module) {
  clearProfileCache();
}

// To run this script: node -r ts-node/register scripts/clear-profile-cache.ts