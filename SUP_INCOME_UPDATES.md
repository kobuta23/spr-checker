# SUP Income Update System Documentation

This document outlines how the SUP Income Update system works in the referral application.

## Overview

The SUP (Superfluid Token) income update system is responsible for tracking and updating the flow rates of SUP tokens for referrers and their referrals. This data is used to determine referrer levels, calculate rewards, and display information on the leaderboard.

## Components

### 1. Blockchain Data Retrieval

The `BlockchainService` class handles all interactions with the Ethereum blockchain:

- **getLockerAddresses**: Retrieves the locker addresses (smart contract wallets) associated with user addresses
- **checkClaimStatus**: Checks a user's units in a specific GDA pool
- **getTotalUnits**: Gets the total units in a GDA pool
- **checkAllClaimStatuses**: Batch check of claim status across multiple addresses and point systems

### 2. SUP Income Management

The `ReferralService` module contains functions to manage SUP income data:

- **fetchSUPIncomeFromBlockchain**: Retrieves the current SUP income for a specific address from the blockchain
- **updateAllSUPIncomes**: Updates SUP income for all referrers and their referrals
- **refreshReferrerData**: Refreshes data for a specific referrer, including their SUP income
- **refreshLevel**: Calculates a referrer's level and maximum referrals based on their total SUP income (user's own income + sum of all referrals' income)

### 3. API Endpoints

The application exposes RESTful endpoints for managing SUP income:

- **POST /api/referrals/update-sup-income**: Triggers an update of SUP income for all referrers and referrals
- **POST /api/referrals/refresh/:address**: Refreshes data for a specific referrer, including SUP income
- **POST /api/referrals/update-discord**: Updates the Discord leaderboard with current SUP income data

### 4. Scheduled Updates

SUP income updates can be triggered automatically using the cron job configuration:

- **cron.json**: Defines scheduled tasks, including regular SUP income updates
- Current schedule: Updates SUP income every 6 hours and the Discord leaderboard daily at noon

### 5. Admin Interface

The admin panel in the LeaderboardTab component provides manual controls:

- Update SUP Income button: Triggers a manual update of all SUP income data
- Update Discord Leaderboard button: Triggers a manual update of the Discord leaderboard

## Data Structure

SUP income is stored as a string representing wei per second (wei/s) in the `referrals.json` file.

Example:
```json
{
  "address": "0x1234567890123456789012345678901234567890",
  "username": "crypto_whale",
  "SUPincome": "923456789012345", // Personal SUP income
  "level": 4,
  "maxReferrals": 20,
  "referrals": [
    {
      "address": "0x2345678901234567890123456789012345678901",
      "SUPincome": "523456789012345" // Referral's SUP income
    }
  ]
}
```

## Level Thresholds

Referrer levels are determined based on total SUP income thresholds (user's own income + the income of all their referrals):

- Level 4: ≥ 0.0008 SUP/s (800,000,000,000,000 wei/s)
- Level 3: ≥ 0.0006 SUP/s (600,000,000,000,000 wei/s)
- Level 2: ≥ 0.0003 SUP/s (300,000,000,000,000 wei/s)
- Level 1: ≥ 0 SUP/s

Each level has a corresponding maximum number of referrals:
- Level 4: 20 referrals
- Level 3: 10 referrals
- Level 2: 5 referrals
- Level 1: 3 referrals

## Flow Calculation

SUP income is calculated based on a user's units in GDA pools:

1. The system retrieves a user's units in each GDA pool
2. It calculates their share of the pool's flow rate based on: 
   ```
   userFlowRate = (memberUnits * poolFlowRate) / totalUnits
   ```
3. The total SUP income is the sum of flow rates across all pools

## Usage

### Automatic Updates

The system automatically updates SUP income every 6 hours through the cron job.

### Manual Updates

Administrators can trigger manual updates:
1. Go to the Leaderboard tab
2. Click the "Admin" button in the top-right corner
3. Use the "Update SUP Income" button to trigger an update
4. Use the "Update Discord Leaderboard" button to update the Discord leaderboard

### API Requests

You can also trigger updates via API:

```bash
# Update SUP income for all referrers
curl -X POST http://localhost:3000/api/referrals/update-sup-income

# Refresh a specific referrer
curl -X POST http://localhost:3000/api/referrals/refresh/0x1234567890123456789012345678901234567890

# Update Discord leaderboard
curl -X POST http://localhost:3000/api/referrals/update-discord
```

## Eligibility API Integration

The system fetches SUP income data directly from the existing eligibility API endpoint that provides an `estimatedFlowrate` value, rather than calculating it from blockchain data:

- The eligibility API provides current and accurate flowrate information
- Using the API ensures consistency with the rest of the application
- This eliminates duplicate code and complex blockchain calculations

## Implementation

The core of this implementation is in the `fetchSUPIncomeFromBlockchain` function in `src/services/referralService.ts`:

```typescript
const fetchSUPIncomeFromBlockchain = async (address: string): Promise<string> => {
  try {
    // Call the eligibility service directly with the address
    const eligibilityResults = await eligibilityService.checkEligibility([address]);
    
    // Extract the relevant data from the response
    if (eligibilityResults && eligibilityResults.length > 0) {
      const addressEligibility = eligibilityResults[0];
      const totalFlowRate = addressEligibility.totalFlowRate || "0";
      
      return totalFlowRate;
    } else {
      return "0";
    }
  } catch (error) {
    logger.error(`Failed to fetch SUP income for address ${address}`, { error });
    return "0";
  }
};
```

Despite its name, this function directly leverages the application's eligibility service to efficiently access flow rate data without making redundant HTTP requests. This approach:

1. Eliminates unnecessary network overhead
2. Ensures data consistency with the rest of the application
3. Takes advantage of the eligibility service's built-in caching

## Update Process

SUP income updates occur through several mechanisms:

1. Automatic updates every 6 hours via cron job
2. Manual refresh of specific referrers via the API endpoint `/api/referrals/refresh/:address`
3. Manual batch update via the admin panel using `/api/referrals/update-sup-income`
4. Automatic updates triggered by certain events (e.g., new referral registration)

## Leveling System

The SUP income values obtained from the eligibility API are used to determine user levels. The level is based on the total income, which is the sum of:
1. The user's own SUP income
2. The combined SUP income of all their referrals

The level thresholds are:
- Level 1: 0 SUP/s (3 max referrals)
- Level 2: 0.0003 SUP/s (5 max referrals)
- Level 3: 0.0006 SUP/s (10 max referrals)
- Level 4: 0.0008 SUP/s (20 max referrals)

The level determines how many referrals a user can have and is updated whenever the SUP income is refreshed.

## Configuration

The eligibility API endpoint is configured in `src/config/index.ts` through the `apiBaseUrl` property, which defaults to `http://localhost:9900/api` but can be overridden by the `API_BASE_URL` environment variable. 