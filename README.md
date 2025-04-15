# Superfluid Eligibility API

## Overview

The Superfluid Eligibility API is a stateless backend service that helps users determine their eligibility for Superfluid tokens. This service aggregates data from multiple Stack point systems and cross-references with blockchain data to provide comprehensive eligibility information.

## Features

- Query eligibility across all 5 Stack point systems in a single request
- Verify on-chain claim status via RPC on Base network
- Stateless architecture for easy scaling and deployment
- RESTful API design
- Slack notifications for monitoring

## Technical Stack

- **Backend**: Node.js with Express
- **Blockchain Interaction**: Viem (for RPC calls)
- **Testing**: Jest
- **Logging**: Winston with Slack integration
- **Deployment**: Docker containerization

## Architecture

The service follows a simple architecture:

1. **API Layer**: Express.js REST endpoints
2. **Service Layer**: Business logic for aggregating data
3. **Integration Layer**: 
   - Stack API client
   - Blockchain client (using Viem)

## Implementation Plan

### Phase 1: Project Setup

1. Initialize a Node.js project
2. Set up Express framework
3. Configure environment variables
4. Set up TypeScript (recommended for type safety)
5. Add linting and formatting tools

### Phase 2: Core API Development

1. Create Stack API client to query the point systems
2. Implement Viem integration for blockchain queries
3. Develop the main eligibility checking service
4. Build Express routes for the API endpoints

### Phase 3: Testing and Documentation

1. Write unit and integration tests
2. Create API documentation using Swagger
3. Document the codebase
4. Create deployment instructions

### Phase 4: Deployment

1. Containerize the application with Docker
2. Set up CI/CD pipeline
3. Deploy to chosen hosting service

## API Endpoints

### GET /api/eligibility

Check eligibility for one or more addresses across all point systems.

**Query Parameters:**
- `addresses`: Comma-separated list of Ethereum addresses to check (required)

**Example Request:**
```
GET /api/eligibility?addresses=0x1234567890123456789012345678901234567890,0x2345678901234567890123456789012345678901
```

**Response Format:**
```json
{
  "results": [
    {
      "address": "0x1234567890123456789012345678901234567890",
      "eligibility": [
        {
          "pointSystemId": 7370,
          "pointSystemName": "Community Activations",
          "eligible": true,
          "allocation": "100",
          "claimed": false,
          "gdaPoolAddress": "0xB7d7331529dC6fb68CB602d9B738CabD84d3ae6d"
        },
        // Additional point systems...
      ]
    },
    // Additional addresses...
  ]
}
```

### GET /stack-activity

Retrieve activity data for a specific address across all point systems or for a specific point system.

**Query Parameters:**
- `address`: Ethereum address to check (required)
- `point-system-id`: ID of a specific point system (optional)

**Example Requests:**
```
GET /stack-activity?address=0x1234567890123456789012345678901234567890
GET /stack-activity?address=0x1234567890123456789012345678901234567890&point-system-id=7370
```

**Response Format (with point-system-id):**
```json
{
  "identity": {
    "address": "0x1234567890123456789012345678901234567890",
    "ensName": "username.eth",
    "farcasterUsername": "username",
    "lensHandle": "username.lens",
    "farcasterPfpUrl": "https://example.com/pfp.jpg"
  },
  "events": [
    {
      "eventType": "contribution",
      "timestamp": "2023-05-17T13:27:15.768Z",
      "points": 100
    }
    // Additional events...
  ],
  "aggregates": [
    {
      "eventType": "contribution",
      "totalPoints": 250,
      "count": 5,
      "firstTimestamp": "2023-03-01T12:00:00.000Z",
      "lastTimestamp": "2023-05-17T13:27:15.768Z"
    }
    // Additional aggregates...
  ]
}
```

**Notes:**
- Results are cached for 12 hours per address and point system combination
- When requesting all point systems, the response will be an array of the above format

### GET /health

Health check endpoint to verify the service is running.

**Example Request:**
```
GET /health
```

**Response Format:**
```json
{
  "status": "ok",
  "timestamp": "2023-03-17T13:27:15.768Z"
}
```

## Development Guide

### Prerequisites

- Node.js (v16+)
- Ethereum RPC endpoint access (Base network)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-org/superfluid-eligibility-api.git
cd superfluid-eligibility-api

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your configuration
```

### Configuration

Create a `.env` file with the following variables:

```
PORT=3000
NODE_ENV=development
ETHEREUM_RPC_URL=https://mainnet.base.org
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/your-webhook-url
STACK_API_BASE_URL=https://athena.stack.so
```

### Running Locally

```bash
# Development mode
npm run dev

# Production mode
npm run build
npm start
```

### Testing

```bash
# Run tests
npm test
```

## Deployment

### Using Docker

```bash
# Build Docker image
docker build -t superfluid-eligibility-api .

# Run Docker container
docker run -p 3000:3000 --env-file .env superfluid-eligibility-api
```

### Using Docker Compose

```bash
# Start services
docker-compose up -d

# Stop services
docker-compose down
```

## Caching and Memoization

The API implements several caching mechanisms to improve performance and reduce load on external services:

### Function Memoization

The application uses the `p-memoize` library to cache expensive function results:

- **Eligibility Service**: The `checkEligibility` function is memoized with a 12-hour (half-day) expiration time.
  - Results are cached based on the sorted, lowercase addresses being queried
  - This significantly reduces load on the Stack API and blockchain RPC endpoints
  - The cache invalidates automatically after 12 hours

```typescript
const checkEligibilityMemoized = pMemoize(_checkEligibility, {
  cache: halfDayCache,
  cacheKey([addresses]) {
    return "check-eligibility-" + addresses.map(x => x.toLowerCase()).sort().join("-");
  }
});
```

- **Stack Activity Service**: Both single point system and all point systems activity queries are memoized with the same 12-hour expiration.
  - Caching is applied per address and point system combination
  - Reduces repeated API calls when users view the same activity data multiple times
  - Especially valuable for the dashboard view showing multiple addresses

```typescript
// Single point system caching
const getStackActivityMemoized = pMemoize(_getStackActivity, {
  cache: halfDayCache,
  cacheKey([address, pointSystemId]) {
    return `stack-activity-${pointSystemId}-${address.toLowerCase()}`;
  }
});

// All point systems caching
const getStackActivityForAllPointSystemsMemoized = pMemoize(_getStackActivityForAllPointSystems, {
  cache: halfDayCache,
  cacheKey([address]) {
    return "stack-activity-all-" + address.toLowerCase();
  }
});
```

### Recipient Data Caching

The `UBARecipients` module implements file-based caching for recipient data:

- **Storage**: Recipient data is stored in a JSON file at `data/UniversalPointRecipients.json`
- **Cache Duration**: By default, recipient data is considered fresh for 20 minutes
- **Selective Updates**: When checking recipients, only those without a locker address or with stale data are processed
- **Cache Control**: The `/recipients` endpoint accepts a `cache` query parameter to control cache invalidation duration

```typescript
// Default cache duration is 20 minutes (1000ms * 60 * 20)
const cacheInvalidationDuration = cacheInvalidation || 1000 * 60 * 20;
```

### Performance Benefits

- **Reduced API Calls**: Memoization reduces calls to external APIs like Stack API
  - Eligibility checks are cached for 12 hours
  - Stack activity data is cached for 12 hours per address and point system
- **Lower Blockchain RPC Usage**: Caching blockchain data reduces RPC calls
- **Faster Response Times**: Cached responses are served immediately without waiting for external services
  - Activity data for popular addresses benefits significantly
  - Dashboard views with multiple point systems load much faster on subsequent views
- **Improved Scalability**: The system can handle more concurrent users with the same resources
  - Cached stack activity data greatly reduces load during high-traffic periods
  - Frontend doesn't need to implement its own caching logic

## Project Structure

```
/
├── src/
│   ├── config/           # Configuration 
│   ├── controllers/      # API route handlers
│   ├── services/         # Business logic
│   │   ├── stack/        # Stack API integration
│   │   └── blockchain/   # Blockchain integration with Viem
│   ├── models/           # Data models and interfaces
│   ├── middleware/       # Express middleware
│   ├── utils/            # Helper functions
│   └── app.ts            # Express application setup
├── tests/                # Test files
```

## Point Systems

The API checks eligibility across the following point systems:

1. Community Activations (ID: 7370)
2. AlfaFrens (ID: 7584)
3. SuperBoring (ID: 7585)
4. Donations (ID: 7587)
5. Payments (ID: 7586)

Each point system corresponds to a GDA pool on the Base network.

## Frontend

A simple frontend application is available in the `frontend` directory. This allows users to:

1. Input an Ethereum address
2. View a detailed breakdown of flowrates per program
3. Toggle between viewing flowrates in units/day or units/month
4. See visual representations of flowrate distributions

The frontend automatically converts the wei/second values from the API into user-friendly units (tokens) by removing the 18 decimals.

### Starting the Frontend

1. Navigate to the frontend directory:
   ```
   cd frontend
   ```

2. Install dependencies (pnpm recommended for faster installation):
   ```
   pnpm install  # Recommended for much faster installation
   ```
   or
   ```
   npm install
   ```

3. Start the development server:
   ```
   pnpm start  # Recommended
   ```
   or
   ```
   npm start
   ```
   or
   ```
   npm run dev
   ```

The frontend will be available at http://localhost:3001 and will automatically connect to the backend API running on port 3000.

## License

[MIT License](LICENSE)
