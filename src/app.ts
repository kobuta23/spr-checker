import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import eligibilityController from './controllers/eligibilityController';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import config from './config';
import logger from './utils/logger';

// Create Express application
const app = express();

// Apply middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(requestLogger); // Log requests

// Define routes
app.get('/eligibility', eligibilityController.checkEligibility);
app.get('/health', eligibilityController.healthCheck);

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

export default app; 