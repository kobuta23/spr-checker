import express from 'express';
import type { Request, Response, NextFunction, Router } from 'express';
import * as authController from '../controllers/authController';

const router: Router = express.Router();

/**
 * Validate authentication code
 * POST /api/auth/validate
 */
router.post('/validate', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authentication code is required'
      });
    }
    
    const result = await authController.validateCode(code);
    return res.status(result.success ? 200 : 401).json(result);
  } catch (error) {
    next(error);
  }
}) as express.RequestHandler);

/**
 * Login with authentication code
 * POST /api/auth/login
 */
router.post('/login', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { code } = req.body;
    
    if (!code) {
      return res.status(400).json({
        success: false,
        message: 'Authentication code is required'
      });
    }
    
    const result = await authController.validateCode(code);
    return res.status(result.success ? 200 : 401).json(result);
  } catch (error) {
    next(error);
  }
}) as express.RequestHandler);

/**
 * Verify authentication token
 * GET /api/auth/verify
 */
router.get('/verify', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Authorization token is missing or invalid'
      });
    }
    
    // Simple validation - in a real app, you would validate the token properly
    // For now, we'll just check that it exists and has a valid format
    const token = authHeader.split(' ')[1];
    if (!token || token.length < 32) {
      return res.status(401).json({
        success: false,
        message: 'Invalid token'
      });
    }
    
    return res.status(200).json({
      success: true,
      message: 'Token is valid'
    });
  } catch (error) {
    next(error);
  }
}) as express.RequestHandler);

export default router; 