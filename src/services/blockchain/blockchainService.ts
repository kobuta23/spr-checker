import { createPublicClient, http } from 'viem';
import { base } from 'viem/chains';
import config from '../../config';
import logger from '../../utils/logger';

const gdaPoolAbi = [
  {
    inputs:[{name:"memberAddr",type:"address"}],
    name: "getUnits",
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

class BlockchainService {
  private client;

  constructor() {
    this.client = createPublicClient({
      chain: base,
      transport: http(config.ethereumRpcUrl)
    });
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
        args: [address as `0x${string}`]
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
}

export default new BlockchainService(); 