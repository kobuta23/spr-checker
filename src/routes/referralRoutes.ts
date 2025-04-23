import express from 'express';
import type { Request, Response, NextFunction, Router, RequestHandler } from 'express';
import * as referralService from '../services/referralService';
import discordService from '../services/discord';
import logger from '../utils/logger';

// Create router
const router: Router = express.Router();
/**
 * Log a new referral
 * POST /api/referrals/log-referral
 */
router.post('/log-referral', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { referralAddress, referralCode } = req.body;
    
    if (!referralAddress || !referralCode) {
      res.status(400).json({ 
        success: false, 
        message: 'Referral address and referrer code are required' 
      });
      return;
    }

    const result = await referralService.logReferral(
    referralAddress, 
    referralCode
    );
    
    logger.info(`Logged new referral: ${referralAddress} with code ${referralCode}`);
    logger.slackNotify(`Logged new referral: ${referralAddress} with code ${referralCode}`, 'info');
    
    // Update Discord leaderboard
    try {
      logger.info('Updating Discord leaderboard');
      // first we should refresh the data for the referrer
      if (result.referrer) {
        await referralService.refreshReferrerData(result.referrer.address);
      }
      await referralService.postLeaderboard();
    } catch (discordError) {
      logger.error('Failed to update Discord leaderboard', { error: discordError });
      // Don't fail the request if Discord update fails
    }
    
    res.status(201).json(result);
  } catch (error: any) {
    logger.error('Error logging referral', { error: error.message });
    
    // Send appropriate error response based on type of error
    if (error.message.includes('already registered')) {
      res.status(409).json({ success: false, message: error.message });
      return;
    } else if (error.message.includes('Invalid') || error.message.includes('already used')) {
      res.status(404).json({ success: false, message: error.message });
      return;
    } else if (error.message.includes('maximum number of referrals')) {
      res.status(403).json({ success: false, message: error.message });
      return;
    }
    
    next(error);
  }
}) as RequestHandler);

/**
 * Get all referrals (leaderboard data)
 * GET /api/referrals
 */
router.get('/', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    // add an API key check here
    
    const referrers = await referralService.getSortedReferrers();
    
    // Use the helper function to calculate derived values for each referrer
    const leaderboardData = referrers.map(referrer => 
      referralService.getEnrichedReferrerData(referrer)
    );
    
    res.json({
      success: true,
      data: leaderboardData
    });
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

/**
 * Get a specific referrer's data
 * GET /api/referrals/:address
 */
router.get('/:address', (async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { address } = req.params;
      const referrer = await referralService.getReferrerByAddress(address);
      
      if (!referrer) {
        res.status(404).json({
          success: false,
          message: 'Referrer not found'
        });
        return;
      }
      
      // Use helper function to get enriched data
      const enrichedData = referralService.getEnrichedReferrerData(referrer);
      
      res.json({
        success: true,
        data: enrichedData
      });
    } catch (error) {
      next(error);
    }
  }) as RequestHandler);
  

export default router; 