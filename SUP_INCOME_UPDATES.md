# SUP Income Update System Documentation

This document outlines how the SUP Income Update system works in the referral application.

## Overview

The SUP (Superfluid Token) income update system is responsible for tracking and updating the flow rates of SUP tokens for referrers and their referrals. This data is used to determine referrer ranks, calculate rewards, and display information on the leaderboard.

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
- **determineRank**: Calculates a referrer's rank and maximum referrals based on their SUP income

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
  "rank": 4,
  "maxReferrals": 20,
  "referrals": [
    {
      "address": "0x2345678901234567890123456789012345678901",
      "SUPincome": "523456789012345" // Referral's SUP income
    }
  ]
}
```

## Rank Thresholds

Referrer ranks are determined based on SUP income thresholds:

- Rank 4: ≥ 0.0008 SUP/s (800,000,000,000,000 wei/s)
- Rank 3: ≥ 0.0006 SUP/s (600,000,000,000,000 wei/s)
- Rank 2: ≥ 0.0003 SUP/s (300,000,000,000,000 wei/s)
- Rank 1: ≥ 0 SUP/s

Each rank has a corresponding maximum number of referrals:
- Rank 4: 20 referrals
- Rank 3: 10 referrals
- Rank 2: 5 referrals
- Rank 1: 3 referrals

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