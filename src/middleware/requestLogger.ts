import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

export const requestLogger = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  const start = Date.now();
  
  // Log request
  logger.info(`Request received: ${req.method} ${req.path}`, {
    method: req.method,
    path: req.path,
    query: req.query,
    ip: req.ip
  });

  // Log response when finished
  res.on('finish', () => {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;
    
    // Log at appropriate level based on status code
    const logMethod = statusCode >= 400 ? 'warn' : 'info';
    
    logger[logMethod](`Response sent: ${statusCode} (${duration}ms)`, {
      method: req.method,
      path: req.path,
      statusCode,
      duration
    });
  });

  next();
}; 