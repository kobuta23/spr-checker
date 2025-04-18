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
import axios from 'axios';
import stackApiService from './services/stack/stackApiService';
import imageProxyRouter from './routes/imageProxy';
import { getRecipients, getHighLevelStats, getStoredRecipients } from './utils/UBARecipients';
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
app.get('/eligibility', eligibilityController.checkEligibility);
app.get('/health', eligibilityController.healthCheck);
app.get('/point-systems', eligibilityController.getPointSystems);
app.get('/recipients', async (req, res) => {
  const cache = Number(req.query.cache); // Default to true if not specified
  const recipients = await getRecipients(cache);
  res.json(recipients);
});

app.get('/recipients-stored', async (req, res) => {
  const recipients = await getStoredRecipients();
  res.json(recipients);
});

app.get('/recipient-stats', async (req, res) => {
  const stats = await getHighLevelStats();
  res.json(stats);
});
// Proxy route for the Superfluid API
app.get('/superfluid/resolve/:address', async (req, res) => {
  try {
    const address = req.params.address;
    const response = await axios.get(`https://whois.superfluid.finance/api/resolve/${address}`);
    res.json(response.data);
  } catch (error) {
    console.error('Error proxying to Superfluid API:', error);
    res.status(500).json({ error: 'Failed to fetch data from Superfluid API' });
  }
});


// document it 
// /stack-activity?address=0x38982E4E9908b2fAA98992D09E8CD31CAB6C6B25
// /stack-activity?address=0x38982E4E9908b2fAA98992D09E8CD31CAB6C6B25&point-system-id=7370

app.get('/stack-activity', async (req, res) => {
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

// Add this after your API routes
// Serve static files from the React app
app.use(express.static(path.join(__dirname, '../src/client/build')));
// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../src/client/public')));

// Specific route for the visualizer (optional)
app.get('/visualizer', (req, res) => {
  res.sendFile(path.join(__dirname, '../src/client/public/visualizer.html'));
});

// The "catchall" handler: for any request that doesn't
// match an API route, send back the React app's index.html
app.get('*', (req, res) => {
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
app.use((req, res) => {
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

// Add this console log to verify loading
console.log("Registering image proxy routes");

// Make sure the path matches what you're calling from frontend
app.use('/api', imageProxyRouter);

export default app; 