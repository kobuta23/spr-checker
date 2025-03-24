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
├── Dockerfile            # Docker configuration
└── docker-compose.yml    # Docker Compose configuration
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
