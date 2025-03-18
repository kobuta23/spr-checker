import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export interface AppError extends Error {
  statusCode?: number;
}

export const errorHandler = (
  err: AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  // Log the error
  logger.error(`Error: ${message}`, {
    path: req.path,
    method: req.method,
    statusCode,
    error: err.stack
  });

  // Send notification to Slack for server errors
  if (statusCode >= 500) {
    logger.slackNotify(`Server error: ${message} at ${req.method} ${req.path}`, 'error');
  }

  // Send error response
  res.status(statusCode).json({
    error: statusCode >= 500 ? 'Internal Server Error' : 'Request Error',
    message,
    statusCode
  });
}; 