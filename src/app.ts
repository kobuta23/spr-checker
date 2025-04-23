/**
 * IMPORTANT: When making changes to API endpoints, remember to update
 * API_DOCUMENTATION.md to keep documentation in sync with the code.
 */

import express, { Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import eligibilityController from './controllers/eligibilityController';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import config from './config';
import logger from './utils/logger';
import path from 'path';
import * as fs from 'fs';
import stackApiService from './services/stack/stackApiService';
import imageProxyRouter from './routes/imageProxy';
import referralRoutes from './routes/referralRoutes';
import { getRecipients, getHighLevelStats, getStoredRecipients } from './utils/UBARecipients';
import { memoizedFetchSuperfluidProfile } from './services/profileService';
import discordService from './services/discord';

require('dotenv').config();

// Create Express application
const app: Express = express();

// Apply middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        // Allow images from external domains
        imgSrc: ["'self'", "data:", "https://euc.li", "https://*.lens.xyz", "https://*.farcaster.xyz", "https://*.ens.domains", "https://i.imgur.com"],
        // Add other domains as needed
      },
    },
  })
);
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(requestLogger); // Log requests

// Define routes

/**
 * Endpoint: GET /eligibility
 * Description: Checks eligibility status
 * Controller: eligibilityController.checkEligibility
 * For detailed parameter information, refer to the eligibilityController implementation
 */
app.get('/eligibility', eligibilityController.checkEligibility);

/**
 * Endpoint: GET /health
 * Description: Verifies if the API is functioning correctly
 * Controller: eligibilityController.healthCheck
 */
app.get('/health', eligibilityController.healthCheck);

/**
 * Endpoint: GET /point-systems
 * Description: Retrieves available point systems
 * Controller: eligibilityController.getPointSystems
 */
app.get('/point-systems', eligibilityController.getPointSystems);

/**
 * Endpoint: GET /recipients
 * Description: Retrieves a list of recipients
 * Query Parameters:
 *   - cache (optional): Number - Controls whether to use cached data (defaults to true if not specified)
 * Response: JSON array of recipients
 */
app.get('/recipients', async (req: express.Request, res: express.Response) => {
  const cache = Number(req.query.cache); // Default to true if not specified
  const recipients = await getRecipients(cache);
  res.json(recipients);
});

/**
 * Endpoint: GET /recipients-stored
 * Description: Retrieves stored recipients data
 * Response: JSON array of stored recipients
 */
app.get('/recipients-stored', async (req: express.Request, res: express.Response) => {
  const recipients = await getStoredRecipients();
  res.json(recipients);
});

/**
 * Endpoint: GET /recipient-stats
 * Description: Retrieves high-level statistical information about recipients
 * Response: JSON object containing recipient statistics
 */
app.get('/recipient-stats', async (req: express.Request, res: express.Response) => {
  const stats = await getHighLevelStats();
  res.json(stats);
});

/**
 * Endpoint: GET /superfluid/resolve/:address
 * Description: Proxies requests to the Superfluid API to resolve information about a blockchain address
 * Uses memoization with a one-week cache to improve performance and reduce API calls
 * Path Parameters:
 *   - address: Ethereum address to resolve
 * Response: Data from Superfluid API in JSON format
 * Error Responses:
 *   - 500 Internal Server Error: If the request to Superfluid API fails
 */
app.get('/superfluid/resolve/:address', async (req: express.Request, res: express.Response) => {
  try {
    const address = req.params.address;
    const data: { handle: string | null; avatarUrl: string | null } = await memoizedFetchSuperfluidProfile(address);
    res.json(data);
  } catch (error) {
    console.error('Error proxying to Superfluid API:', error);
    res.status(500).json({ error: 'Failed to fetch data from Superfluid API' });
  }
});

/**
 * Endpoint: GET /stack-activity
 * Description: Retrieves activity data from Stack protocol for a given address
 * Query Parameters:
 *   - address (required): String - Ethereum address to query (must be a valid 40-character hex address with optional '0x' prefix)
 *   - point-system-id (optional): Number - Specific point system ID to filter results
 * Response: 
 *   - If point-system-id is provided: Activity data for the specified point system
 *   - If point-system-id is not provided: Activity data across all point systems
 * Error Responses:
 *   - 400 Bad Request: If the address is missing or invalid
 * Example Requests:
 *   - /stack-activity?address=0x38982E4E9908b2fAA98992D09E8CD31CAB6C6B25
 *   - /stack-activity?address=0x38982E4E9908b2fAA98992D09E8CD31CAB6C6B25&point-system-id=7370
 */
app.get('/stack-activity', async (req: express.Request, res: express.Response) => {
  const address = req.query.address as string;
  // check if address is valid
  if (!address || !/^(0x)?[0-9a-fA-F]{40}$/.test(address)) {
    res.status(400).json({ error: 'Invalid address' });
    return;
  }

  const pointSystemId = req.query['point-system-id'] ? Number(req.query['point-system-id']) : undefined;
  if (!pointSystemId) {
    const stackActivity = await stackApiService.getStackActivityForAllPointSystems(address);
    res.json(stackActivity);
  } else {
    const stackActivity = await stackApiService.getStackActivity(address, pointSystemId);
    res.json(stackActivity);
  }
});

/**
 * Route Group: /api/referrals
 * Description: Handles referral-related operations
 * Router: referralRoutes
 * For detailed endpoint information, refer to the referralRoutes implementation
 */
console.log("Registering referral routes");
app.use('/api/referrals', referralRoutes);

// Add this after your API routes
// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../src/client/build')));
// Serve static files from the 'public' directory
app.use('/assets', express.static(path.join(__dirname, '../src/client/build/assets')));
app.use('/static', express.static(path.join(__dirname, '../src/client/build/static')));

/**
 * Endpoint: GET /visualizer
 * Description: Serves the visualizer HTML page
 * Response: HTML content
 */
app.get('/visualizer', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, '../src/client/public/visualizer.html'));
});

// The "catchall" handler: for any request that doesn't
// match an API route, send back the React app's index.html
app.get('*', (req: express.Request, res: express.Response) => {
  res.sendFile(path.join(__dirname, '../src/client/build/index.html'));
});

// Debug paths
const potentialPaths = [
  path.join(__dirname, '../src/client/build'),
  path.join(__dirname, '../client/build'),
  path.join(__dirname, '../../client/build'),
  path.join(__dirname, '../../src/client/build')
];

potentialPaths.forEach(p => {
  try {
    console.log(`Checking path: ${p}`);
    console.log(`Path exists: ${fs.existsSync(p)}`);
    if (fs.existsSync(p)) {
      console.log('Files in directory:', fs.readdirSync(p));
    }
  } catch (err) {
    console.log(`Error checking path ${p}:`, (err as Error).message);
  }
});

// Function to log all registered routes
function logRoutes(app: express.Application) {
  const routes: Array<{ method: string; path: string }> = [];
  
  app._router.stack.forEach((middleware: any) => {
    if (middleware.route) {
      // Routes registered directly
      const methods = Object.keys(middleware.route.methods)
        .filter(method => middleware.route.methods[method])
        .map(method => method.toUpperCase());
      
      routes.push({
        path: middleware.route.path,
        method: methods.join(',')
      });
    } else if (middleware.name === 'router') {
      // Router middleware
      middleware.handle.stack.forEach((handler: any) => {
        if (handler.route) {
          const methods = Object.keys(handler.route.methods)
            .filter(method => handler.route.methods[method])
            .map(method => method.toUpperCase());
          
          routes.push({
            path: handler.route.path,
            method: methods.join(',')
          });
        }
      });
    }
  });
  
  logger.info('REGISTERED ROUTES:');
  routes.forEach(r => logger.info(`${r.method} ${r.path}`));
  return routes;
}

// Log all registered routes
const registeredRoutes = logRoutes(app);
logger.slackNotify(`Registered Routes: ${JSON.stringify(registeredRoutes)}`, 'info');

// Handle 404 errors
app.use((req: express.Request, res: express.Response) => {
  res.status(404).json({
    error: 'Not Found',
    message: `Route ${req.method} ${req.path} not found`,
    statusCode: 404
  });
});

// Apply error handler
app.use(errorHandler);

// Start the server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server started on port ${PORT}`);
  logger.slackNotify(`Superfluid Eligibility API server started on port ${PORT}`, 'info');
  discordService.initialize();
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason: Error) => {
  logger.error('Unhandled Promise Rejection', { error: reason.stack });
  logger.slackNotify(`Unhandled Promise Rejection: ${reason.message}`, 'error');
});

// Handle uncaught exceptions
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught Exception', { error: error.stack });
  logger.slackNotify(`Uncaught Exception: ${error.message}`, 'error');
  
  // Exit with error
  process.exit(1);
});

/**
 * Route Group: /api
 * Description: Image proxy routes for handling external image requests while respecting CSP
 * Router: imageProxyRouter
 * For detailed endpoint information, refer to the imageProxyRouter implementation
 */
console.log("Registering image proxy routes");
app.use('/api', imageProxyRouter);

export default app; 