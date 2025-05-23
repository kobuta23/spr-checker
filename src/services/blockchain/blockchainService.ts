import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import config from '../../config';
import logger from '../../utils/logger';
import axios from 'axios';

const gdaPoolAbi = [
  {
    inputs:[{name:"memberAddr",type:"address"}],
    name: "getUnits",
    outputs:[{name:"", type:"uint128"}],
    stateMutability:"view",
    type:"function"
  },
  {
    inputs:[],
    name: "getTotalUnits",
    outputs:[{name:"", type:"uint128"}],
    stateMutability:"view",
    type:"function"
  }
] as const;

const getUserLockerAbi = [
  {
    inputs:[{name:"memberAddr",type:"address"}],
    name: "getUserLocker",
    outputs:[{name:"", type:"bool"}, {name:"", type:"address"}],
    stateMutability:"view",
    type:"function"
  }
] as const;

/**
 * Blockchain Service for interacting with Ethereum contracts
 * Note: SUP income is now fetched directly from the eligibility API endpoint 
 * rather than being calculated from blockchain data through this service.
 * This service is still used for other blockchain interactions.
 */
class BlockchainService {
  private client;

  constructor() {
    this.client = createPublicClient({
      chain: base,
      transport: http(config.ethereumRpcUrl)
    });
  }

  async getUserNonce(address: `0x${string}`): Promise<number> {
    const transactionCount
      = await this.client.getTransactionCount({  
        address,
      })
  return Number(transactionCount)
  }
  /**
   * Check the number of total units in a GDA pool so we can calculate the user's flowrate
   * @param gdaPoolAddress Address of the GDA pool contract
   * @returns Promise with total units
   */
  async getTotalUnits(gdaPoolAddress: string): Promise<bigint> {
    const totalUnits = await this.client.readContract({
      address: gdaPoolAddress as `0x${string}`,
      abi: gdaPoolAbi,
      functionName: 'getTotalUnits',
    });
    return totalUnits;
  }

  /**
   * Check if an address has claimed tokens for a specific GDA pool
   * @param address Ethereum address to check
   * @param gdaPoolAddress Address of the GDA pool contract
   * @returns Promise with claim status
   */
  async checkClaimStatus(lockerAddress: string, gdaPoolAddress: string): Promise<bigint> {
    try {
      logger.info(`Checking claim status for address ${lockerAddress} on GDA pool ${gdaPoolAddress}`);
      // This is a placeholder implementation
      const memberUnits = await this.client.readContract({
        address: gdaPoolAddress as `0x${string}`,
        abi: gdaPoolAbi,
        functionName: 'getUnits',
        args: [lockerAddress as `0x${string}`]
      });
      return memberUnits;
    } catch (error) {
      logger.error(`Failed to check claim status for address ${lockerAddress} on GDA pool ${gdaPoolAddress}`, { error });
      // Default to not claimed in case of error
      return BigInt(0);
    }
  }

  /**
   * Get the locker addresses for multiple addresses
   * @param addresses Array of Ethereum addresses
   * @returns Promise with locker addresses for each address
   */
  async getLockerAddresses(addresses: string[]): Promise<Map<string, string>> {
    const lockerAddresses = new Map<string, string>();
    for (const address of addresses) {
      const [exists, lockerAddress] = await this.client.readContract({
        address: config.lockerFactoryAddress as `0x${string}`,
        abi: getUserLockerAbi,
        functionName: 'getUserLocker',
        args: [address.toLowerCase() as `0x${string}`]
      });
      if (exists) {
        lockerAddresses.set(address, lockerAddress);
      }
    }
    return lockerAddresses;
  }

  /**
   * Check claim status for multiple addresses across all GDA pools
   * @param addresses Array of Ethereum addresses
   * @returns Promise with claim status for each address and GDA pool
   */
  async checkAllClaimStatuses(lockerAddresses: Map<string, string>): Promise<Map<string, Map<number, bigint>>> {
    const allClaimStatuses = new Map<string, Map<number, bigint>>();
    
    // Initialize the map for each address
    lockerAddresses.forEach((lockerAddress, address) => {
      allClaimStatuses.set(address, new Map<number, bigint>());
    });

    // Process each address and point system combination
    const promises = [];
    
    for (const [address, lockerAddress] of lockerAddresses.entries()) {
      for (const { id, gdaPoolAddress } of config.pointSystems) {
        promises.push(
          (async () => {
            try {
              const memberUnits = await this.client.readContract({
                address: gdaPoolAddress as `0x${string}`,
                abi: gdaPoolAbi,
                functionName: 'getUnits',
                args: [lockerAddress as `0x${string}`]
              });
              
              const statusMap = allClaimStatuses.get(address);
              if (statusMap) {
                statusMap.set(id, memberUnits);
              }
            } catch (error) {
              logger.error(`Error checking claim status for address ${address} on point system ${id}`, { error });
              // Set default status in case of error
              const statusMap = allClaimStatuses.get(address);
              if (statusMap) {
                statusMap.set(id, BigInt(0));
              }
            }
          })()
        );
      }
    }
    
    // Wait for all promises to resolve
    await Promise.all(promises);

    return allClaimStatuses;
  }

  async getLockers(addresses: string[]): Promise<Map<string, {lockerAddress: string, blockTimestamp: string}>> {
    const lockerAddresses = new Map<string, {lockerAddress: string, blockTimestamp: string}>();
    let hasMore = true;
    let skip = 0;
    const pageSize = 1000;

    const query = `query MyQuery {
      lockers(first: ${pageSize}, skip: ${skip}, orderBy: blockTimestamp, orderDirection: desc) {
        lockerOwner
        id
        blockTimestamp
      }
    }`


    while (hasMore) {
      try {
        const response = await axios.post(config.LOCKER_GRAPH_URL, {
          query
        });

        const lockers = response.data?.data?.lockers || [];
        
        // Process lockers and match with addresses we're looking for
        for (const locker of lockers) {
          const ownerAddress = locker.lockerOwner.toLowerCase();
          if (addresses.some(addr => addr.toLowerCase() === ownerAddress)) {
            lockerAddresses.set(ownerAddress, {lockerAddress: locker.id, blockTimestamp: locker.blockTimestamp});
          }
        }
        // Check if we've found all addresses or need to fetch more pages
        if (lockerAddresses.size === addresses.length || lockers.length < pageSize) {
          hasMore = false;
        } else {
          skip += pageSize;
        }

        // Exit early if we've found all addresses
        if (lockerAddresses.size === addresses.length) {
          break;
        }

      } catch (error) {
        logger.error('Error fetching lockers from subgraph', { error });
        hasMore = false;
      }
    }

    return lockerAddresses;
  }

}

export default new BlockchainService(); 