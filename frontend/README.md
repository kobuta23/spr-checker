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