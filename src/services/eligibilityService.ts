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
      const lockerAddresses = await blockchainService.getLockerAddresses(addresses);
      console.log(lockerAddresses);
      // Check claim status on blockchain
      const allClaimStatuses = await blockchainService.checkAllClaimStatuses(lockerAddresses);
      console.log('allClaimStatuses');
      console.log(allClaimStatuses);
      // Combine the data for each address
      const results = addresses.map(address => {
        const eligibility: PointSystemEligibility[] = [];
        let claimNeeded = false;
        let hasAllocations = false;
        // Process each point system
        config.pointSystems.forEach(pointSystem => {
          const { id, name, gdaPoolAddress } = pointSystem;
          
          // Find allocation for this address
          const allocations = allAllocations.get(id) || [];
          const allocation = allocations.find(a => a?.accountAddress?.toLowerCase() === address.toLowerCase());
          
          // Get claim status for this address and point system
          const claimStatus = allClaimStatuses.get(address)?.get(id);
          const needToClaim = BigInt(allocation?.points || 0) - (claimStatus || BigInt(0)) > BigInt(0);
          // Add eligibility data
          eligibility.push({
            pointSystemId: id,
            pointSystemName: name,
            eligible: !!allocation && allocation.allocation !== BigInt(0),
            allocation: (allocation?.points || 0).toString(),
            claimedAmount: (claimStatus || BigInt(0)).toString(),
            needToClaim,
            gdaPoolAddress
          });
          if(needToClaim) {
            claimNeeded = true;
          }
          if(allocation?.points && allocation.points > 0) {
            hasAllocations = true;
          }
        });
        
        return {
          address,
          eligibility,
          hasAllocations,
          claimNeeded
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