import stackApiService from './stack/stackApiService';
import blockchainService from './blockchain/blockchainService';
import logger from '../utils/logger';
import config from '../config';
import { AddressEligibility, PointSystemEligibility, StackAllocation } from '../models/types';
import { latestRecipients } from '../utils/UBARecipients';
const { POINT_THRESHOLD, POINTS_TO_ASSIGN, COMMUNITY_ACTIVATION_ID, THRESHOLD_TIME_PERIOD, THRESHOLD_MAX_USERS } = config;
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

      // Auto-assign points to addresses with < 99 points (V2 update)
      const newCommunityAllocations = this.autoAssignPoints(addresses, allAllocations);
      console.log("updatedAllocations: ", newCommunityAllocations);
      allAllocations.set(COMMUNITY_ACTIVATION_ID, newCommunityAllocations);
      // Get locker addresses
      let lockerAddresses: Map<string, string> = new Map();
      try {
        lockerAddresses = await blockchainService.getLockerAddresses(addresses);
      } catch (error) {
        logger.error('Failed to get locker addresses', { error });
        logger.slackNotify(`Failed to get locker addresses for addresses: ${addresses.join(', ')}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      // Check claim status on blockchain
      let allClaimStatuses: Map<string, Map<number, bigint>> = new Map();
      try {
        allClaimStatuses = await blockchainService.checkAllClaimStatuses(lockerAddresses);
      } catch (error) {
        logger.error('Failed to get claim statuses', { error });
        logger.slackNotify(`Failed to get claim statuses for addresses: ${addresses.join(', ')}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
      // Use BigInt for flow rate calculations
      let totalFlowRateBigInt = BigInt(0);
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
        // Reset total flow rate for each address
        totalFlowRateBigInt = BigInt(0);
        
        // Process each point system
        config.pointSystems.forEach(async (pointSystem) => {
          const { id, name, gdaPoolAddress, flowrate, totalUnits } = pointSystem;
          // Find allocation for this address
          const allocations = allAllocations.get(id) || [];
          const { points } = allocations.find(a => a?.accountAddress?.toLowerCase() === address.toLowerCase()) || { points: 0 };
          let estimatedFlowRateBigInt = BigInt(0);
          const claimStatus = allClaimStatuses.get(address)?.get(id);
          const amountToClaimBigInt = BigInt(points) - (claimStatus || BigInt(0));
          const needToClaim = amountToClaimBigInt > BigInt(0);
          const amountToClaim = Number(amountToClaimBigInt);
          
          // TODO: split into two numbers: "estimated (after claim)", and "estimated (before claim)"
          // for now, going only with "pre-claim" cos bankless wants
          if(totalUnits > 0) { // only shows flowrate if the user has claimed. Wrong.  
            // All calculations using BigInt
            const claimStatusBigInt = claimStatus;
            const totalUnitsBigInt = BigInt(totalUnits + amountToClaim);
            const pointsBigInt = BigInt(points);
            console.log("numbers for calculation of flowrate")
            // Calculation: (points / totalUnits) * flowrate
            const scaleFactor = BigInt(1000000000); // 10^9 for precision
            console.log(`( ${points} * ${scaleFactor} / ${totalUnitsBigInt} ) * ${flowrate} / ${scaleFactor}`);
            estimatedFlowRateBigInt = (pointsBigInt * scaleFactor / totalUnitsBigInt) * flowrate / scaleFactor;
            
            // Add to total
            totalFlowRateBigInt += estimatedFlowRateBigInt;
          }
          // if(!!claimStatus && claimStatus > 0 && totalUnits > 0) { // only shows flowrate if the user has claimed. Wrong.  
          //   // All calculations using BigInt
          //   const claimStatusBigInt = BigInt(claimStatus);
          //   const totalUnitsBigInt = BigInt(totalUnits + amountToClaim);
          //   console.log("numbers for calculation of flowrate")
          //   // Calculation: (points / totalUnits) * flowrate
          //   const scaleFactor = BigInt(1000000000); // 10^9 for precision
          //   console.log(`( ${claimStatusBigInt} * ${scaleFactor} / ${totalUnitsBigInt} ) * ${flowrate} / ${scaleFactor}`);
          //   estimatedFlowRateBigInt = (claimStatusBigInt * scaleFactor / totalUnitsBigInt) * flowrate / scaleFactor;
            
          //   // Add to total
          //   totalFlowRateBigInt += estimatedFlowRateBigInt;
          // }

          const obj = {
            pointSystemId: id,
            pointSystemName: name,
            eligible: points > 0,
            points,
            claimedAmount: Number(claimStatus) || 0,
            needToClaim,
            gdaPoolAddress,
            // Store as string to preserve precision
            estimatedFlowRate: estimatedFlowRateBigInt.toString()
          };
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
          // Store as string to preserve precision
          totalFlowRate: totalFlowRateBigInt.toString(),
          eligibility
        };
      });
      
      logger.info(`Eligibility check completed for ${addresses.length} addresses`);
      return results as AddressEligibility[];
    } catch (error) {
      logger.error('Failed to check eligibility', { error });
      throw new Error(`Failed to check eligibility: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Auto-assign points to addresses with less than threshold points (V2 Update)
   * @param addresses Array of Ethereum addresses to check and assign points to
   * @param allAllocations Current allocations map from Stack API
   */
  private autoAssignPoints(addresses: string[], allAllocations: Map<number, StackAllocation[]>): StackAllocation[] {
    console.log("allAllocations: ", allAllocations);
    // Get existing allocations for the community activation point system
    const communityAllocations:StackAllocation[] = [...(allAllocations.get(COMMUNITY_ACTIVATION_ID) || [])];
    console.log("communityAllocations popped: ", communityAllocations);
    // Process each address
    // @ts-ignore
    const updatedCommunityAllocations:StackAllocation[] = addresses.map((address): StackAllocation => {
      // Find existing allocation for this address in Community Activation
      const existingAllocation = communityAllocations.find(
        a => a.accountAddress.toLowerCase() === address.toLowerCase()
      ) || {
        pointSystemUuid: "28abd1a3-bba1-43af-9033-5059580c1b61",
        accountAddress: address,
        points: 0,
        allocation: BigInt(0),
        maxCreatedAt: new Date().toISOString()
      };
      
      // Get current point balance, defaulting to 0 if not found
      const currentPoints = existingAllocation?.points || 0;
      let finalPoints = currentPoints;
      // If points are below threshold, assign more points
      if (currentPoints < POINT_THRESHOLD) {
        // now we need to check that we're under the threshold of 100 users per hour
        const recipientsToppedUp = latestRecipients(THRESHOLD_TIME_PERIOD).length;
        console.log("recipientsToppedUp: ", recipientsToppedUp);
        if(recipientsToppedUp < THRESHOLD_MAX_USERS) {
          logger.info(`Address ${address} has ${currentPoints} points, auto-assigning ${POINTS_TO_ASSIGN} points`);
          
          // Fire and forget - don't wait for completion
          stackApiService.assignPoints(address, POINTS_TO_ASSIGN);
        
          // Update allocation in our local map for immediate response
          finalPoints += POINTS_TO_ASSIGN;
        } else {
          logger.info(`Address ${address} has ${currentPoints} points, not auto-assigning ${POINTS_TO_ASSIGN} points because we're over the threshold of ${THRESHOLD_MAX_USERS} users per hour`);
          logger.slackNotify(`Address ${address} has ${currentPoints} points, not auto-assigning ${POINTS_TO_ASSIGN} points because we're over the threshold of ${THRESHOLD_MAX_USERS} users per hour`);
        }
      }
      return {...existingAllocation, points: finalPoints};
    });
    return updatedCommunityAllocations;
  }
}

export default new EligibilityService();