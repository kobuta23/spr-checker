import express from 'express';
import type { Request, Response, NextFunction, Router, RequestHandler } from 'express';
import * as referralService from '../services/referralService';
import * as discordService from '../services/discordService';
import logger from '../utils/logger';

// Create router
const router: Router = express.Router();

// Maximum number of referrals per referrer (configurable)
const MAX_REFERRALS_PER_REFERRER = 10;

/**
 * Add a new referrer
 * POST /api/referrals/add-referrer
 */
const addReferrerHandler = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address, discordUsername } = req.body;
    
    if (!address || !discordUsername) {
      res.status(400).json({ 
        success: false, 
        message: 'Address and discordUsername are required' 
      });
      return;
    }
    
    const result = await referralService.addReferrer(address, discordUsername);
    
    logger.info(`Added new referrer: ${address} (${discordUsername})`);
    logger.slackNotify(`Added new referrer: ${address} (${discordUsername})`, 'info');
    
    res.status(201).json(result);
  } catch (error: any) {
    logger.error('Error adding referrer', { error: error.message });
    
    // Send appropriate error response based on type of error
    if (error.message.includes('already registered') || error.message.includes('already taken')) {
      res.status(409).json({ success: false, message: error.message });
      return;
    }
    
    next(error);
  }
};

router.post('/add-referrer', addReferrerHandler);

/**
 * Log a new referral
 * POST /api/referrals/log-referral
 */
router.post('/log-referral', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { referralAddress, referrerCode } = req.body;
    
    if (!referralAddress || !referrerCode) {
      res.status(400).json({ 
        success: false, 
        message: 'Referral address and referrer code are required' 
      });
      return;
    }
    
    const result = await referralService.logReferral(
      referralAddress, 
      referrerCode
    );
    
    logger.info(`Logged new referral: ${referralAddress} with code ${referrerCode}`);
    logger.slackNotify(`Logged new referral: ${referralAddress} with code ${referrerCode}`, 'info');
    
    // Update Discord leaderboard
    try {
      const referrers = await referralService.getSortedReferrers();
      await discordService.postLeaderboardToDiscord(referrers);
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
 * Get available referral codes for a referrer
 * GET /api/referrals/codes/:address
 */
router.get('/codes/:address', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params;
    const result = await referralService.getAvailableCodes(address);
    res.json(result);
  } catch (error: any) {
    logger.error('Error getting referral codes', { error: error.message });
    
    if (error.message.includes('not found')) {
      res.status(404).json({ success: false, message: error.message });
      return;
    }
    
    next(error);
  }
}) as RequestHandler);

/**
 * Generate new referral codes for a referrer
 * POST /api/referrals/generate-codes/:address
 */
router.post('/generate-codes/:address', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params;
    const result = await referralService.generateNewCodes(address);
    
    logger.info(`Generated new referral codes for ${address}`);
    
    res.json(result);
  } catch (error: any) {
    logger.error('Error generating referral codes', { error: error.message });
    
    if (error.message.includes('not found')) {
      res.status(404).json({ success: false, message: error.message });
      return;
    } else if (error.message.includes('maximum number')) {
      res.status(400).json({ success: false, message: error.message });
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
    const referrers = await referralService.getSortedReferrers();
    
    // Calculate derived values for each referrer
    const leaderboardData = referrers.map(referrer => {
      // Calculate total SUPincome of referred users
      const totalSUPincome = referrer.referrals.reduce(
        (sum, referral) => sum + BigInt(referral.SUPincome),
        BigInt(0)
      ).toString();
      
      // Calculate average SUPincome (if there are referrals)
      const avgSUPincome = referrer.referrals.length > 0
        ? (BigInt(totalSUPincome) / BigInt(referrer.referrals.length)).toString()
        : "0";
      
      return {
        address: referrer.address,
        username: referrer.username,
        SUPincome: referrer.SUPincome,
        rank: referrer.rank,
        maxReferrals: referrer.maxReferrals,
        unusedCodes: referrer.unusedCodes,
        referralCount: referrer.referrals.length,
        totalReferralSUPincome: totalSUPincome,
        avgReferralSUPincome: avgSUPincome,
        referrals: referrer.referrals.sort((a, b) => {
          // Sort referrals by SUPincome in descending order
          return BigInt(b.SUPincome) > BigInt(a.SUPincome) ? 1 : -1;
        })
      };
    });
    
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
    
    // Calculate derived values
    const totalSUPincome = referrer.referrals.reduce(
      (sum, referral) => sum + BigInt(referral.SUPincome),
      BigInt(0)
    ).toString();
    
    const avgSUPincome = referrer.referrals.length > 0
      ? (BigInt(totalSUPincome) / BigInt(referrer.referrals.length)).toString()
      : "0";
    
    // Sort referrals by SUPincome
    const sortedReferrals = [...referrer.referrals].sort((a, b) => {
      return BigInt(b.SUPincome) > BigInt(a.SUPincome) ? 1 : -1;
    });
    
    res.json({
      success: true,
      data: {
        address: referrer.address,
        username: referrer.username,
        SUPincome: referrer.SUPincome,
        rank: referrer.rank,
        maxReferrals: referrer.maxReferrals,
        referralCount: referrer.referrals.length,
        unusedCodes: referrer.unusedCodes,
        totalReferralSUPincome: totalSUPincome,
        avgReferralSUPincome: avgSUPincome,
        referrals: sortedReferrals
      }
    });
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

/**
 * Refresh data for a specific referrer
 * POST /api/referrals/refresh/:address
 */
router.post('/refresh/:address', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { address } = req.params;
    const referrer = await referralService.refreshReferrerData(address);
    
    if (!referrer) {
      res.status(404).json({
        success: false,
        message: 'Referrer not found'
      });
      return;
    }
    
    logger.info(`Refreshed data for referrer: ${address}`);
    
    // Calculate derived values
    const totalSUPincome = referrer.referrals.reduce(
      (sum, referral) => sum + BigInt(referral.SUPincome),
      BigInt(0)
    ).toString();
    
    const avgSUPincome = referrer.referrals.length > 0
      ? (BigInt(totalSUPincome) / BigInt(referrer.referrals.length)).toString()
      : "0";
    
    // Sort referrals by SUPincome
    const sortedReferrals = [...referrer.referrals].sort((a, b) => {
      return BigInt(b.SUPincome) > BigInt(a.SUPincome) ? 1 : -1;
    });
    
    // Update Discord leaderboard
    try {
      const allReferrers = await referralService.getSortedReferrers();
      await discordService.postLeaderboardToDiscord(allReferrers);
    } catch (discordError) {
      logger.error('Failed to update Discord leaderboard after refresh', { error: discordError });
      // Don't fail the request if Discord update fails
    }
    
    res.json({
      success: true,
      data: {
        address: referrer.address,
        username: referrer.username,
        SUPincome: referrer.SUPincome,
        rank: referrer.rank,
        maxReferrals: referrer.maxReferrals,
        referralCount: referrer.referrals.length,
        unusedCodes: referrer.unusedCodes,
        totalReferralSUPincome: totalSUPincome,
        avgReferralSUPincome: avgSUPincome,
        referrals: sortedReferrals
      }
    });
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

/**
 * Update Discord leaderboard manually
 * POST /api/referrals/update-discord
 */
router.post('/update-discord', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    const referrers = await referralService.getSortedReferrers();
    const success = await discordService.postLeaderboardToDiscord(referrers);
    
    if (success) {
      logger.info('Discord leaderboard updated manually');
      res.json({
        success: true,
        message: 'Discord leaderboard updated successfully'
      });
    } else {
      res.status(500).json({
        success: false,
        message: 'Failed to update Discord leaderboard'
      });
    }
  } catch (error) {
    next(error);
  }
}) as RequestHandler);

/**
 * Update SUP income for all referrers and their referrals
 * POST /api/referrals/update-sup-income
 */
router.post('/update-sup-income', (async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info('Manual trigger of SUP income update');
    
    await referralService.updateAllSUPIncomes();
    
    logger.info('SUP income update completed successfully');
    
    // Update Discord leaderboard after updating incomes
    try {
      const allReferrers = await referralService.getSortedReferrers();
      await discordService.postLeaderboardToDiscord(allReferrers);
    } catch (discordError) {
      logger.error('Failed to update Discord leaderboard after SUP income update', { error: discordError });
      // Don't fail the request if Discord update fails
    }
    
    res.json({
      success: true,
      message: 'SUP income updated successfully for all referrers'
    });
  } catch (error) {
    logger.error('Failed to update SUP income', { error });
    next(error);
  }
}) as RequestHandler);

export default router; 