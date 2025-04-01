import { Request, Response } from 'express';
import eligibilityService from '../services/eligibilityService';
import logger from '../utils/logger';
import config from '../config';
import blockchainService from '../services/blockchain/blockchainService';
import stackApiService from '../services/stack/stackApiService';

const POINT_SYSTEM_COLORS: Record<number, string> = {
  7370: '#EC4899', // pink-500 - Community Activations
  7584: '#3B82F6', // blue-500 - AlfaFrens
  7585: '#000000', // black - SuperBoring
  7586: '#F59E0B', // yellow-500 - Payments
  7587: '#10B981', // green-500 - Donations
  7246: '#00faff', // light blue - GoodDollar
}

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
        logger.slackNotify(`Checked <https://superfluid-eligibility-api.s.superfluid.dev/?addresses=${address}|${address}>. *${hasAllocations && claimNeeded ? 'Claim needed' : hasAllocations && !claimNeeded ? 'Is fully claimed' : 'No allocations'}*`, 'info');
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
   * Endpoint to get all point systems with their details
   * @param req Express request
   * @param res Express response
   */
  async getPointSystems(req: Request, res: Response): Promise<void> {
    try {
      // Create a copy of point systems with color information
      const pointSystems = await Promise.all(
        config.pointSystems.map(async (ps) => {
          // Define helper functions inside the method to avoid 'this' context issues
          const getPointSystemColor = (id: number): string => {
            return POINT_SYSTEM_COLORS[id] || '#6B7280'; // Default to gray-500
          };
          
          // Get total units for this point system
          const totalUnits = await blockchainService.getTotalUnits(ps.gdaPoolAddress);
          
          return {
            ...ps,
            color: getPointSystemColor(ps.id),
            totalUnits: Number(totalUnits)
          };
        })
      );
      
      res.status(200).json({ pointSystems });
    } catch (error) {
      logger.error('Error in get point systems endpoint', { error });
      
      res.status(500).json({
        error: 'Internal Server Error',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
        statusCode: 500
      });
    }
  }

  /**
   * Convert wei/second flow rate to units per day or month
   * @param flowrateWei Flow rate in wei/second
   * @param unit 'day' or 'month'
   * @returns Flow rate in units per day or month as a string
   */
  private convertFlowRateToUnits(flowrateWei: bigint, unit: 'day' | 'month'): string {
    // Constants for conversion
    const ONE_ETHER = 10n ** 18n;
    const SECONDS_PER_DAY = 86400n;
    const SECONDS_PER_MONTH = 2592000n; // 30 days
    
    // Choose the appropriate time unit
    const secondsPerUnit = unit === 'day' ? SECONDS_PER_DAY : SECONDS_PER_MONTH;
    
    // Calculate flow rate with high precision
    const precisionFactor = 10n ** 20n;
    const flowRateInUnits = (flowrateWei * secondsPerUnit * precisionFactor) / ONE_ETHER;
    
    // Convert to a decimal string with proper formatting
    const decimalValue = Number(flowRateInUnits) / Number(precisionFactor);
    
    // Format based on the value
    if (decimalValue < 0.0001) {
      return decimalValue.toExponential(4);
    } else if (decimalValue < 1) {
      return decimalValue.toFixed(4);
    } else if (decimalValue < 1000) {
      return decimalValue.toFixed(2);
    } else {
      return decimalValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
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