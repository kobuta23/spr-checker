import { Request, Response } from 'express';
import eligibilityService from '../services/eligibilityService';
import logger from '../utils/logger';

class EligibilityController {
  /**
   * Check eligibility for provided addresses
   * @param req Express request
   * @param res Express response
   */
  async checkEligibility(req: Request, res: Response): Promise<void> {
    try {
      // Get addresses from query parameter
      const addressesParam = req.query.addresses as string;
      
      if (!addressesParam) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'The addresses parameter is required',
          statusCode: 400
        });
        return;
      }
      
      // Parse addresses
      const addresses = addressesParam.split(',').map(addr => addr.trim());
      
      if (addresses.length === 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: 'At least one address must be provided',
          statusCode: 400
        });
        return;
      }
      
      // Validate addresses (simple validation)
      const invalidAddresses = addresses.filter(addr => !addr.match(/^0x[a-fA-F0-9]{40}$/));
      if (invalidAddresses.length > 0) {
        res.status(400).json({
          error: 'Bad Request',
          message: `Invalid Ethereum addresses: ${invalidAddresses.join(', ')}`,
          statusCode: 400
        });
        return;
      }
      
      // Check eligibility
      const results = await eligibilityService.checkEligibility(addresses);

      // Return results
      res.status(200).json({ results });
      
      for( const result of results) {
        const {address, hasAllocations, claimNeeded} = result;
        logger.slackNotify(`Checked <https://main.superfluid.dev:9900/?addresses=${address}|${address}>. *${hasAllocations && claimNeeded ? 'Claim needed' : hasAllocations && !claimNeeded ? 'Is fully claimed' : 'No allocations'}*`, 'info');
      }
      // Log success
      logger.info(`Check completed for ${addresses.length} addresses`);
    } catch (error) {
      // Log error
      logger.error('Error in eligibility check endpoint', { error });
      
      // Return error response
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        statusCode: 500
      });
      
      // Send notification to Slack for server errors
      logger.slackNotify(`Error in eligibility check endpoint: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
    }
  }

  /**
   * Health check endpoint
   * @param req Express request
   * @param res Express response
   */
  async healthCheck(req: Request, res: Response): Promise<void> {
    try {
      res.status(200).json({
        status: 'ok',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      logger.error('Health check failed', { error });
      res.status(500).json({
        error: 'Internal Server Error',
        message: 'Health check failed',
        statusCode: 500
      });
    }
  }
}

export default new EligibilityController(); 