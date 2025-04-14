import axios from 'axios';
import config from '../../config';
import logger from '../../utils/logger';
import { StackApiResponse, StackAllocation } from '../../models/types';
import { addRecipient, getStoredRecipients, latestRecipients } from '../../utils/UBARecipients';

const COMMUNITY_ACTIVATION_ID = 7370;
const { THRESHOLD_TIME_PERIOD } = config;

class StackApiService {
  private baseUrl: string;
  private apiKey: string;
  private writeApiKey: string;

  constructor() {
    this.baseUrl = config.stackApiBaseUrl;
    this.apiKey = process.env.STACK_API_KEY || '';
    this.writeApiKey = process.env.STACK_WRITE_API_KEY || '';
  }

  /**
   * Fetch allocations for a specific point system and addresses
   * @param pointSystemId The ID of the point system
   * @param addresses Array of Ethereum addresses
   * @returns Promise with allocation data
   */
  async fetchAllocations(pointSystemId: number, addresses: string[]): Promise<StackAllocation[]> {
    try {
      const url = `${this.baseUrl}/point-system/${pointSystemId}/allocations`;
      
      logger.info(`Fetching allocations from ${url} for ${addresses.length} addresses`);
      
      const response = await axios.post<StackApiResponse>(url, 
        { addresses }, 
        {
          headers: {
            'x-api-key': this.apiKey,
            'Content-Type': 'application/json'
          }
        }
      );
      return response.data.res.allocations || [];
    } catch (error) {
      logger.error(`Failed to fetch allocations for point system ${pointSystemId}`, { error });
      throw new Error(`Failed to fetch allocations: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Fetch allocations for multiple point systems and addresses
   * @param addresses Array of Ethereum addresses
   * @returns Promise with allocation data grouped by point system
   */
  async fetchAllAllocations(addresses: string[]): Promise<Map<number, StackAllocation[]>> {
    const allAllocations = new Map<number, StackAllocation[]>();
    
    // Use Promise.all to fetch from all point systems in parallel
    await Promise.all(
      config.pointSystems.map(async (pointSystem) => {
        try {
          const allocations = await this.fetchAllocations(pointSystem.id, addresses);
          allAllocations.set(pointSystem.id, allocations);
        } catch (error) {
          logger.error(`Error fetching allocations for point system ${pointSystem.id}`, { error });
          // Set empty array for failed point system to maintain consistency
          allAllocations.set(pointSystem.id, []);
        }
      })
    );

    return allAllocations;
  }

  /**
   * Assign points to an address in a specific point system
   * @param pointSystemId The ID of the point system to assign points in
   * @param address Ethereum address to assign points to
   * @param points Number of points to assign
   * @returns Promise with assignment result
   */
  async assignPoints(address: string, points: number): Promise<boolean> {
    try {
      // Only proceed if we have a write API key
      if (!this.writeApiKey) {
        logger.error('Cannot assign points: STACK_WRITE_API_KEY not set');
        return false;
      }

      const url = `https://track.stack.so/event`;
      // ${this.baseUrl}/point-system/${pointSystemId}/assign`;
      
      logger.info(`Assigning ${points} points to ${address} in point system ${COMMUNITY_ACTIVATION_ID}`);
      const data = [{
        "name": "universal_allocation",
        "account": address.toLowerCase(),
        "pointSystemId": COMMUNITY_ACTIVATION_ID,
        "uniqueId": `universal-allocation-${address.toLowerCase()}`, // make up a unique id for the allocation
        "points": points
      }]
      const response = await axios.post(url, 
        data,
        {
          headers: {
            'x-api-key': this.writeApiKey,
            'Content-Type': 'application/json'
          }
        }
      );

      if (response.status >= 200 && response.status < 300) {
        logger.info(`Successfully assigned ${points} points to ${address}`);
        logger.slackNotify(`Successfully assigned ${points} points to ${address}`, 'info');
        // add recipient to UBARecipients list
        addRecipient({ address });
        const recipients = getStoredRecipients();
        const lastHour = latestRecipients(THRESHOLD_TIME_PERIOD).length;
        logger.slackNotify(`Added ${address} to UBARecipients list. ${recipients.length} recipients in list. ${lastHour} in the last hour `);
        return true;
      } else {
        logger.error(`Failed to assign points, received status ${response.status}`);
        logger.slackNotify(`Failed to assign points, received status ${response.status}`, 'error');
        return false;
      }
    } catch (error) {
      logger.error(`Failed to assign ${points} points to ${address}`, { error });
      logger.slackNotify(`Failed to assign ${points} points to ${address}`, 'error');
      return false;
    }
  }
}

export default new StackApiService(); 