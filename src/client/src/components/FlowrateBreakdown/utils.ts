import { AddressEligibility, PointSystemEligibility } from '../../types';

export type TimeUnit = 'day' | 'month';

// Color configuration for point systems
export const POINT_SYSTEM_COLORS: Record<number, string> = {
  // Community Activations - Primary community engagement program
  7370: '#EC4899', // pink-500 - Community Activations
  
  // AlfaFrens - Community rewards program
  7584: '#3B82F6', // blue-500
  
  // SuperBoring - Special program
  7585: '#000000', // black
  
  // Payments - Payment-related rewards
  7586: '#F59E0B', // yellow-500
  
  // Donations - Donation-based rewards
  7587: '#10B981', // green-500

  // GoodDollar - GoodDollar-related rewards
  7246: '#00faff', // light blue
};

// Get color for a point system ID
export const getPointSystemColor = (pointSystemId: number): string => {
  // If we have a specific color for this ID, use it
  if (POINT_SYSTEM_COLORS[pointSystemId]) {
    return POINT_SYSTEM_COLORS[pointSystemId];
  }
  // For any new point systems that might be added in the future,
  // use a color based on the ID modulo the number of default colors
  const defaultColors = [
    '#0EA5E9', // sky-500
    '#F97316', // orange-500
    '#6366F1', // indigo-500
    '#14B8A6', // teal-500
    '#EC4899', // pink-500
  ];
  const colorIndex = pointSystemId % defaultColors.length;
  return defaultColors[colorIndex];
};

// Helper function to collect all unique point systems across all addresses
export const getAllPointSystems = (dataList: AddressEligibility[]): Record<number, string> => {
  const pointSystems: Record<number, string> = {};
  
  dataList.forEach(data => {
    data.eligibility.forEach(item => {
      if (!pointSystems[item.pointSystemId]) {
        pointSystems[item.pointSystemId] = item.pointSystemName;
      }
    });
  });
  
  return pointSystems;
};

// Convert flowrate for display
export const convertFlowRate = (weiPerSecondStr: string, unit: TimeUnit): string => {
  const weiPerSecond = BigInt(weiPerSecondStr || '0');
  if (weiPerSecond === BigInt(0)) return '0';
  
  const oneEther = BigInt(10) ** BigInt(18);
  const multiplier = BigInt(unit === 'day' ? 86400 : 2592000);
  
  const valueNumerator = weiPerSecond * multiplier;
  const valueDenominator = oneEther;
  
  const precisionFactor = BigInt(10) ** BigInt(20);
  const decimalValue = Number((valueNumerator * precisionFactor) / valueDenominator) / Number(precisionFactor);
  
  if (decimalValue < 0.0001) {
    return decimalValue.toExponential(2);
  } else if (decimalValue < 1) {
    return decimalValue.toFixed(4);
  } else if (decimalValue < 1000) {
    return decimalValue.toFixed(2);
  } else {
    return decimalValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
};

// Calculate percentage for pie chart
export const calculatePercentage = (flowRateStr: string, totalFlowRateStr: string): number => {
  const flowRate = BigInt(flowRateStr || '0');
  const totalFlowRate = BigInt(totalFlowRateStr || '0');
  
  if (totalFlowRate === BigInt(0) || flowRate === BigInt(0)) return 0;
  
  const precisionFactor = BigInt(10000);
  return Number((flowRate * precisionFactor) / totalFlowRate) / 100;
};

// Calculate unclaimed points
export const getUnclaimedPoints = (points: number, claimed: number): number => {
  return Math.max(0, points - claimed);
};

// Find eligibility item
export const findEligibilityItem = (data: AddressEligibility, pointSystemId: number): PointSystemEligibility | undefined => {
  return data.eligibility.find(item => item.pointSystemId === pointSystemId);
};

// Calculate flowrate for individual activity
export const calculateActivityFlowrate = (activityPoints: number, totalPoints: number, totalFlowrate: string): string => {
  if (totalPoints === 0 || activityPoints === 0) return '0';
  
  const proportion = activityPoints / totalPoints;
  const flowrateBigInt = BigInt(totalFlowrate || '0');
  
  const scaleFactor = BigInt(1000000);
  const proportionScaled = BigInt(Math.floor(proportion * Number(scaleFactor)));
  
  const activityFlowrateBigInt = (flowrateBigInt * proportionScaled) / scaleFactor;
  return activityFlowrateBigInt.toString();
};

// Calculate total flowrates for an address
export const calculateAddressFlowrates = (data: AddressEligibility) => {
  let totalClaimedFlowrateBigInt = BigInt(0);
  let totalUnclaimedFlowrateBigInt = BigInt(0);
  
  data.eligibility.forEach(item => {
    if (item.points === 0) return;
    
    const claimedProportion = Math.min(item.claimedAmount / item.points, 1);
    const itemFlowRateBigInt = BigInt(item.estimatedFlowRate || '0');
    
    const scaleFactor = BigInt(1000000);
    const claimedProportionFixed = BigInt(Math.floor(claimedProportion * Number(scaleFactor)));
    
    const claimedFlowrateBigInt = (itemFlowRateBigInt * claimedProportionFixed) / scaleFactor;
    const unclaimedFlowrateBigInt = item.needToClaim ? (itemFlowRateBigInt - claimedFlowrateBigInt) : BigInt(0);
    
    totalClaimedFlowrateBigInt += claimedFlowrateBigInt;
    totalUnclaimedFlowrateBigInt += unclaimedFlowrateBigInt;
  });
  
  return {
    totalClaimedFlowrate: totalClaimedFlowrateBigInt.toString(),
    totalUnclaimedFlowrate: totalUnclaimedFlowrateBigInt.toString(),
    totalFlowrate: (totalClaimedFlowrateBigInt + totalUnclaimedFlowrateBigInt).toString()
  };
}; 