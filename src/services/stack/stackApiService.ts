import axios from 'axios';
import config from '../../config';
import { getStackApiKey } from '../../config';
import logger from '../../utils/logger';
import { StackApiResponse, StackAllocation } from '../../models/types';
import { addRecipient, getStoredRecipients, latestRecipients } from '../../utils/UBARecipients';
const COMMUNITY_ACTIVATION_ID = 7370;
const { THRESHOLD_TIME_PERIOD } = config;
import { formatEvents, FormattedStackEvents } from './formatUtils';
class StackApiService {
  private baseUrl: string;
  private apiKey: string;
  private writeApiKey: string;

  constructor() {
    this.baseUrl = config.stackApiBaseUrl;
    if(!process.env.STACK_API_KEY) {
      throw new Error('STACK_API_KEY is not set');
    }
    this.apiKey = process.env.STACK_API_KEY;
    if(!process.env.STACK_WRITE_API_KEY) {
      throw new Error('STACK_WRITE_API_KEY is not set');
    }
    this.writeApiKey = process.env.STACK_WRITE_API_KEY;

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

  /**
   * Get stack activity for all point systems for a specific address
   * @param address Ethereum address
   * @returns Promise with stack activity data
   */
  async getStackActivityForAllPointSystems(address: string) {
    const activity = await Promise.all(config.pointSystems.map((pointSystem) => this.getStackActivity(address, pointSystem.id)));
    return activity;
  }

  /**
   * Get stack activity for a specific address and point system
   * @param address Ethereum address
   * @param pointSystemId The ID of the point system
   * @returns Promise with stack activity data
   */
  async getStackActivity(address: string, pointSystemId: number): Promise<FormattedStackEvents> {
    try {
      let allResults: any[] = [];
      let hasMore = true;
      let offset = 0;
      const limit = 100;

      while (hasMore) {
        const query = {
          limit,
          offset,
          where: {
            associatedAccount: address
          },
          orderBy: [
            { eventTimestamp: "desc" },
            { associatedAccount: "asc" }
          ]
        };

        const url = new URL(`${this.baseUrl}/point-system/${pointSystemId}/events`);
        url.search = new URLSearchParams({
          query: JSON.stringify(query)
        }).toString();

        const response = await axios.get(url.toString(), {
          headers: {
            'x-api-key': getStackApiKey(pointSystemId) || this.writeApiKey
          }
        });
        console.log(url.toString());
        console.log(this.apiKey);

        const results = response.data;
        allResults = [...allResults, ...results];

        // Check if we got less results than limit, meaning no more pages
        if (results.length < limit) {
          hasMore = false;
        } else {
          offset += limit;
        }
      }

      return formatEvents(allResults);
    } catch (error) {
      logger.error(`Error getting stack activity for ${address} in point system ${pointSystemId}`, { error });
      console.log(error);
      return {
        identity: {
          address: '',
          ensName: null,
          farcasterUsername: null,
          lensHandle: null,
          farcasterPfpUrl: null
        },
        events: [],
        aggregates: []
      };
    }
  }
}

export default new StackApiService(); 