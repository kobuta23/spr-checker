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

export default router; 