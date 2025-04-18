# Scripts

This directory contains utility scripts for the SPR Checker application.

## remove-points.ts

### Purpose

This script identifies and removes points from users who have a low transaction count (nonce) on the blockchain, indicating potential gaming or misuse of the system.

### How It Works

1. Downloads and caches the complete recipient list from the production API (only downloads once)
2. Loads (or creates) a list of previously processed users from `data/booted-users.json`
3. For each recipient:
   - Skips users who have already been processed
   - Checks if their blockchain nonce is below the threshold (5 transactions)
   - If the nonce is below threshold, removes 99 points from their account
   - Records the action in the booted-users.json file

### Requirements

- Node.js 16+
- Access to the Ethereum RPC endpoint (set in .env)
- Stack API key with write permissions (set in .env as STACK_WRITE_API_KEY)

### Environment Variables

Make sure the following environment variables are set in your `.env` file:

```
ETHEREUM_RPC_URL=https://mainnet.base.org
STACK_API_KEY=your_read_api_key
STACK_WRITE_API_KEY=your_write_api_key
```

### Usage

Run the script using:

```bash
# Using npm
npm run remove-points

# Using pnpm
pnpm run remove-points

# Directly with ts-node
npx ts-node scripts/remove-points.ts

# Dry run mode (no points will actually be removed)
npx ts-node scripts/remove-points.ts --dry-run

# Force re-download of recipients list
npx ts-node scripts/remove-points.ts --force-download
```

### Output Files

The script creates and maintains two JSON files:

1. `data/stored-recipients.json` - The cached recipient list downloaded from the API 
2. `data/booted-users.json` - Records of all processed users:

```json
[
  {
    "address": "0x123...",
    "nonce": 3,
    "pointsRemoved": true,
    "removedDate": "2023-06-01T12:00:00.000Z"
  }
]
```

### Logs

The script logs detailed information about its progress to both the console and log files, including:
- Download status of recipient list
- Number of recipients processed
- Results of nonce checks
- Success/failure of point removal operations 