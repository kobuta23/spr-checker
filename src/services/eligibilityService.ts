import stackApiService from './stack/stackApiService';
import blockchainService from './blockchain/blockchainService';
import logger from '../utils/logger';
import config from '../config';
import { AddressEligibility, PointSystemEligibility } from '../models/types';

class EligibilityService {
  /**
   * Check eligibility for multiple addresses across all point systems
   * @param addresses Array of Ethereum addresses
   * @returns Promise with eligibility data for each address
   */
  async checkEligibility(addresses: string[]): Promise<AddressEligibility[]> {
    try {
      // Log the start of the eligibility check
      logger.info(`Checking eligibility for ${addresses.length} addresses`);
      
      // Fetch allocations from Stack API
      const allAllocations = await stackApiService.fetchAllAllocations(addresses);
      console.log(allAllocations);

      // Get locker addresses
      let lockerAddresses: Map<string, string> = new Map();
      try {
        lockerAddresses = await blockchainService.getLockerAddresses(addresses);
        console.log(lockerAddresses);
      } catch (error) {
        logger.error('Failed to get locker addresses', { error });
        logger.slackNotify(`Failed to get locker addresses for addresses: ${addresses.join(', ')}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      // Check claim status on blockchain
      let allClaimStatuses: Map<string, Map<number, bigint>> = new Map();
      try {
        allClaimStatuses = await blockchainService.checkAllClaimStatuses(lockerAddresses);
        console.log('allClaimStatuses');
        console.log(allClaimStatuses);
      } catch (error) {
        logger.error('Failed to get claim statuses', { error });
        logger.slackNotify(`Failed to get claim statuses for addresses: ${addresses.join(', ')}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      let totalFlowRate = 0;
      for (const pointSystem of config.pointSystems) {
        // Get total units for this point system
        const totalUnits = await blockchainService.getTotalUnits(pointSystem.gdaPoolAddress);
        pointSystem.totalUnits = Number(totalUnits);
      }
      // Combine the data for each address
      const results = addresses.map(address => {
        const eligibility: PointSystemEligibility[] = [];
        let claimNeeded = false;
        let hasAllocations = false;
        // Process each point system
        config.pointSystems.forEach(async (pointSystem) => {
          const { id, name, gdaPoolAddress, flowrate, totalUnits } = pointSystem;
          // Find allocation for this address
          const allocations = allAllocations.get(id) || [];
          const { points } = allocations.find(a => a?.accountAddress?.toLowerCase() === address.toLowerCase()) || { points: 0 };
          let estimatedFlowRate = 0;
          const claimStatus = allClaimStatuses.get(address)?.get(id);
          const amountToClaim:number = Number(BigInt(points) - (claimStatus || BigInt(0)));
          const needToClaim = amountToClaim > 0;
          if(points > 0 && totalUnits > 0) {
            estimatedFlowRate = Math.floor(Number(points) / (totalUnits + amountToClaim) * flowrate);
            totalFlowRate += estimatedFlowRate;
          }
          // Get claim status for this address and point system

          const obj = {
            pointSystemId: id,
            pointSystemName: name,
            eligible: points > 0,
            points,
            claimedAmount: Number(claimStatus) || 0,
            needToClaim,
            gdaPoolAddress,
            estimatedFlowRate
          };
          console.log("obj", obj);
          // Add eligibility data
          eligibility.push(obj);
          if(needToClaim) {
            claimNeeded = true;
          }
          if(points > 0) {
            hasAllocations = true;
          }
        });
        
        return {
          address,
          hasAllocations,
          claimNeeded,
          totalFlowRate,
          eligibility
        };
      });
      
      logger.info(`Eligibility check completed for ${addresses.length} addresses`);
      return results;
    } catch (error) {
      logger.error('Failed to check eligibility', { error });
      throw new Error(`Failed to check eligibility: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

export default new EligibilityService(); 