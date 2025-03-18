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
app.get('/api/eligibility', eligibilityController.checkEligibility);
app.get('/health', eligibilityController.healthCheck);

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