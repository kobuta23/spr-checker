import axios from "axios";
import logger from "../utils/logger";
import { oneWeekCache } from "../config/cache";
import pMemoize from "p-memoize";

/**
 * Fetches profile data from Superfluid API for a given address
 */
const fetchSuperfluidProfile = async (address: string): Promise<{ handle: string | null; avatarUrl: string | null }> => {
    logger.info(`Fetching Superfluid profile for ${address}`);
    const response = await axios.get(`https://whois.superfluid.finance/api/resolve/${address}`);
    // let's do a better job here, and give back only one point of information
    // the ens name    
    const { AlfaFrens, ENS, Farcaster, Lens } = response.data;
    const handle = ENS?.handle || Farcaster?.handle || Lens?.handle || AlfaFrens?.handle || null;
    const avatarUrl = ENS?.avatarUrl || Farcaster?.avatarUrl || Lens?.avatarUrl || AlfaFrens?.avatarUrl || null;

    return { handle, avatarUrl };
  };
  
 export const memoizedFetchSuperfluidProfile = pMemoize(fetchSuperfluidProfile, {
    cache: oneWeekCache
  });