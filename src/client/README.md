# Superfluid Flowrate Checker Frontend

A simple frontend application that allows users to input an Ethereum address and see a breakdown of their flowrate per program.

## Features

- Input Ethereum address with validation
- Display flowrate breakdown by point system with day/month toggle
- Visual representation of flowrate percentages
- Highlighting addresses that need to claim tokens
- Conversion from wei/second to user-friendly units per day or month

## Technologies Used

- React with TypeScript
- Vite for fast development and building
- Tailwind CSS for styling
- Axios for API requests
- Viem for Ethereum functionality

## Getting Started

### Prerequisites

- Node.js (v16 or higher)
- npm, yarn, or pnpm

### Installation

1. Clone the repository
2. Navigate to the frontend directory:
   ```
   cd frontend
   ```
3. Install dependencies (recommended to use pnpm for faster installation):
   ```
   pnpm install  # Recommended (faster)
   ```
   or
   ```
   npm install
   ```
   or
   ```
   yarn
   ```

### Development

To start the development server:

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

The application will be available at http://localhost:3001

### Building for Production

To build the application for production:

```
pnpm build  # Recommended
```
or
```
npm run build
```

The built files will be in the `dist` directory.

### Configuration

The application is configured to proxy API requests to the backend running on port 3000 using Vite's proxy configuration in `vite.config.ts`.

## API Integration

The frontend integrates with the Superfluid Eligibility API by sending GET requests to:

```
/eligibility?addresses=0x...
```

This endpoint returns data about the eligibility and flowrate of the provided address. 

## URL Schema

The application uses URL parameters to maintain state, enabling easy sharing and bookmarking of specific views. The URL schema follows this pattern:

```
?addresses=0x123,0x456&timeUnit=day&highlight=community-activations&expanded=7370
```

Parameters explained:
- `addresses`: Comma-separated list of Ethereum addresses to display
- `timeUnit`: Display flowrate per "day" (omitted when set to "month" as it's the default)
- `highlight`: The name of the row to highlight in kebab-case. For programs, it's the program name in kebab-case (e.g., "community-activations"); for activities, it's the activity name in kebab-case plus the program ID (e.g., "followed-us-7370")
- `expanded`: Comma-separated list of program IDs (4-digit codes) for which activities are expanded

This stateful URL approach allows users to share specific views, including selected addresses and expanded program details in a concise format.