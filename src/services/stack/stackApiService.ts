import axios from 'axios';
import config from '../../config';
import logger from '../../utils/logger';
import { StackApiResponse, StackAllocation } from '../../models/types';

class StackApiService {
  private baseUrl: string;
  private apiKey: string;

  constructor() {
    this.baseUrl = config.stackApiBaseUrl;
    this.apiKey = process.env.STACK_API_KEY || '';
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
}

export default new StackApiService(); 