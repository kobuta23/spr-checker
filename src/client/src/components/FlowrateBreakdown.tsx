import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { AddressEligibility, PointSystemEligibility } from '../types';
import UserProfileDisplay, { UserProfile } from '../components/UserProfileDisplay';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import axios from 'axios';
// Color configuration for point systems
const POINT_SYSTEM_COLORS: Record<number, string> = {
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
const getPointSystemColor = (pointSystemId: number): string => {
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

interface FlowrateBreakdownProps {
  dataList: AddressEligibility[];
  userProfiles: Record<string, UserProfile>;
  onAddressCopy: (address: string) => void;
  onRemoveUser: (address: string) => void;
  onAddAddress: (address: string) => void;
  isLoading: boolean;
}

type TimeUnit = 'day' | 'month';

// Helper function to collect all unique point systems across all addresses
const getAllPointSystems = (dataList: AddressEligibility[]): Record<number, string> => {
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

// Add this new component for the pie chart
const FlowratePieChart = ({ 
  data, 
  pointSystemColors, 
  pointSystemNames 
}: { 
  data: { pointSystemId: number; flowrate: number }[], 
  pointSystemColors: Record<number, string>,
  pointSystemNames: Record<number, string>
}) => {
  const chartData = data.map(item => ({
    name: pointSystemNames[item.pointSystemId],
    value: item.flowrate,
    color: pointSystemColors[item.pointSystemId]
  }));

  return (
    <div className="w-12 h-12 mr-2">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={chartData}
            dataKey="value"
            nameKey="name"
            cx="50%"
            cy="50%"
            innerRadius={0}
            outerRadius={20}
            paddingAngle={1}
          >
            {chartData.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.color} />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value: number) => `${value.toFixed(1)}%`}
            contentStyle={{ 
              backgroundColor: 'white', 
              border: '1px solid #ccc',
              borderRadius: '4px'
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
};

// New interfaces for stack-activity
interface StackActivity {
  identity: {
    address: string;
    ensName: string | null;
    farcasterUsername: string | null;
    lensHandle: string | null;
    farcasterPfpUrl: string | null;
  };
  events: {
    eventType: string;
    timestamp: string;
    points: number;
  }[];
  aggregates: {
    eventType: string;
    totalPoints: number;
    count: number;
    firstTimestamp: string;
    lastTimestamp: string;
  }[];
}

interface ExpandedActivities {
  [key: string]: { // key is `${pointSystemId}-${address}`
    isLoading: boolean;
    error: string | null;
    data: StackActivity | null;
  }
}

const FlowrateBreakdown = ({ 
  dataList, 
  userProfiles, 
  onAddressCopy, 
  onRemoveUser,
}: FlowrateBreakdownProps) => {
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('month');
  const [expandedActivities, setExpandedActivities] = useState<ExpandedActivities>({});
  //const [flowratePerUnitInProgram, setFlowratePerUnitInProgram] = useState<Map<number, string>>(new Map());
  // Early return if no data
  if (!dataList.length) return null;
  
  // Get all unique point systems across all addresses
  const allPointSystems = getAllPointSystems(dataList);
  const pointSystemIds = Object.keys(allPointSystems).map(Number);
  
  // Calculate claimed and unclaimed flowrates
  const addressFlowrates = useMemo(() => {
    return dataList.map(data => {
      // Calculate flowrates for each address
      let totalClaimedFlowrateBigInt = BigInt(0);
      let totalUnclaimedFlowrateBigInt = BigInt(0);
      
      data.eligibility.forEach(item => {
        // Calculate claimed and unclaimed portions of the flowrate
        // If there are points but none are claimed, all the flowrate is unclaimed
        // If some points are claimed, calculate the proportion
        if (item.points === 0) {
          // No points means no flowrate
          return;
        }
        
        // Calculate actual (claimed) flowrate
        const claimedProportion = Math.min(item.claimedAmount / item.points, 1);
        const itemFlowRateBigInt = BigInt(item.estimatedFlowRate || '0');
        
        // Use BigInt and fixed point for precision
        const scaleFactor = BigInt(1000000); // 6 decimal places for proportion
        const claimedProportionFixed = BigInt(Math.floor(claimedProportion * Number(scaleFactor)));
        
        const claimedFlowrateBigInt = (itemFlowRateBigInt * claimedProportionFixed) / scaleFactor;
        
        // Calculate unclaimed (potential) flowrate
        const unclaimedFlowrateBigInt = item.needToClaim ? (itemFlowRateBigInt - claimedFlowrateBigInt) : BigInt(0);
        
        totalClaimedFlowrateBigInt += claimedFlowrateBigInt;
        totalUnclaimedFlowrateBigInt += unclaimedFlowrateBigInt;
      });
      
      return {
        totalClaimedFlowrate: totalClaimedFlowrateBigInt.toString(),
        totalUnclaimedFlowrate: totalUnclaimedFlowrateBigInt.toString(),
        totalFlowrate: (totalClaimedFlowrateBigInt + totalUnclaimedFlowrateBigInt).toString()
      };
    });
  }, [dataList]);
  
  // Update convertFlowRate to accept string
  const convertFlowRate = (weiPerSecondStr: string, unit: TimeUnit): string => {
    const weiPerSecond = BigInt(weiPerSecondStr || '0');
    if (weiPerSecond === BigInt(0)) return '0';
    
    // Handle BigInt calculations for precision
    // We'll use a fixed-point approach with 18 decimal places
    const oneEther = BigInt(10) ** BigInt(18);
    
    // Convert wei to units (divide by 10^18)
    // unitsPerSecond is now a rational number represented as a fraction
    const unitsPerSecondNumerator = weiPerSecond;
    const unitsPerSecondDenominator = oneEther;
    
    // Convert seconds to days or months
    const multiplier = BigInt(unit === 'day' ? 86400 : 2592000); // 86400 seconds in a day, ~2592000 in a month (30 days)
    
    // Compute with extended precision to avoid truncation
    const valueNumerator = unitsPerSecondNumerator * multiplier;
    const valueDenominator = unitsPerSecondDenominator;
    
    // Convert to decimal for display
    // Use a high precision division
    const precisionFactor = BigInt(10) ** BigInt(20); // 20 decimal places
    const decimalValue = Number((valueNumerator * precisionFactor) / valueDenominator) / Number(precisionFactor);
    
    // Format the number without K/M notation
    if (decimalValue < 0.0001) {
      return decimalValue.toExponential(2);
    } else if (decimalValue < 1) {
      return decimalValue.toFixed(4);
    } else if (decimalValue < 1000) {
      return decimalValue.toFixed(2);
    } else {
      // Return the full number with commas for thousands
      return decimalValue.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
  };

  // Get percentage of each program's flowrate relative to total
  const calculatePercentage = (flowRateStr: string, totalFlowRateStr: string) => {
    const flowRate = BigInt(flowRateStr || '0');
    const totalFlowRate = BigInt(totalFlowRateStr || '0');
    
    if (totalFlowRate === BigInt(0) || flowRate === BigInt(0)) return 0;
    
    // Calculate percentage with precision
    const precisionFactor = BigInt(10000); // 2 decimal places (100.00%)
    const percentage = Number((flowRate * precisionFactor) / totalFlowRate) / 100;
    
    return percentage;
  };

  // Calculate unclaimed points
  const getUnclaimedPoints = (points: number, claimed: number): number => {
    return Math.max(0, points - claimed);
  };

  // Find eligibility item for a specific point system
  const findEligibilityItem = (data: AddressEligibility, pointSystemId: number): PointSystemEligibility | undefined => {
    return data.eligibility.find(item => item.pointSystemId === pointSystemId);
  };
  
  // Load stack-activity data for a single address
  const loadStackActivity = useCallback(async (address: string, pointSystemId: number, forceCollapse = false) => {
    const activityKey = `${pointSystemId}-${address}`;
    
    // Check if already expanded - if so, collapse it
    if ((expandedActivities[activityKey] && expandedActivities[activityKey].data) || forceCollapse) {
      setExpandedActivities(prev => {
        const newState = { ...prev };
        delete newState[activityKey];
        return newState;
      });
      return;
    }
    
    // Set loading state
    setExpandedActivities(prev => ({
      ...prev,
      [activityKey]: {
        isLoading: true,
        error: null,
        data: null
      }
    }));
    
    try {
      const response = await axios.get(`/stack-activity?address=${address}&point-system-id=${pointSystemId}`);
      setExpandedActivities(prev => ({
        ...prev,
        [activityKey]: {
          isLoading: false,
          error: null,
          data: response.data
        }
      }));
    } catch (error) {
      let errorMessage = 'Failed to load activity data';
      if (axios.isAxiosError(error) && error.response) {
        errorMessage = error.response.data.message || errorMessage;
      }
      
      setExpandedActivities(prev => ({
        ...prev,
        [activityKey]: {
          isLoading: false,
          error: errorMessage,
          data: null
        }
      }));
    }
  }, [expandedActivities]);

  // Load stack activity data for all addresses for a specific point system
  const loadStackActivityForProgram = useCallback(async (pointSystemId: number) => {
    // Check if any address for this point system is already expanded
    const isAnyExpanded = dataList.some(data => 
      expandedActivities[`${pointSystemId}-${data.address}`] && 
      expandedActivities[`${pointSystemId}-${data.address}`].data
    );
    
    if (isAnyExpanded) {
      // If any are expanded, collapse all for this point system
      for (const data of dataList) {
        await loadStackActivity(data.address, pointSystemId, true);
      }
    } else {
      // Otherwise, expand all for this point system
      for (const data of dataList) {
        await loadStackActivity(data.address, pointSystemId);
      }
    }
  }, [dataList, expandedActivities, loadStackActivity]);

  // Calculate flowrate for an individual activity based on point proportion
  const calculateActivityFlowrate = (
    activityPoints: number,
    totalPoints: number,
    totalFlowrate: string
  ): string => {
    if (totalPoints === 0 || activityPoints === 0) return '0';
    
    const proportion = activityPoints / totalPoints;
    const flowrateBigInt = BigInt(totalFlowrate || '0');
    
    // Use BigInt for precision
    const scaleFactor = BigInt(1000000); // 6 decimal places
    const proportionScaled = BigInt(Math.floor(proportion * Number(scaleFactor)));
    
    const activityFlowrateBigInt = (flowrateBigInt * proportionScaled) / scaleFactor;
    return activityFlowrateBigInt.toString();
  };
  
  // Add useEffect to handle auto-expanding activities for new users
  useEffect(() => {
    // Get all point systems that are currently expanded for any address
    const expandedPointSystems = new Set<number>();
    
    Object.keys(expandedActivities).forEach(key => {
      const [pointSystemId] = key.split('-');
      if (expandedActivities[key].data) {
        expandedPointSystems.add(Number(pointSystemId));
      }
    });
    
    // If there are any expanded point systems and we have addresses
    if (expandedPointSystems.size > 0 && dataList.length > 0) {
      // Check each expanded point system
      expandedPointSystems.forEach(pointSystemId => {
        // For each address, check if it already has activity data
        dataList.forEach(data => {
          const activityKey = `${pointSystemId}-${data.address}`;
          
          // If this address doesn't have activity data for this point system,
          // but other addresses do, then load data for this address too
          if (!expandedActivities[activityKey]) {
            // Use a setTimeout to avoid too many simultaneous requests
            // and to let the component render first
            setTimeout(() => {
              loadStackActivity(data.address, pointSystemId);
            }, 100);
          }
        });
      });
    }
  }, [dataList, expandedActivities, loadStackActivity]);

  // useEffect(() => {
  //   const fetchFlowratePerUnit = async () => {
  //     const flowrateMap = new Map<number, string>();
  //     const pointSystems: any = (await axios.get(`/point-systems`));
  //     console.log("pointSystems", pointSystems);
  //     pointSystems.foreach( (system:any) => {
  //       const { flowrate, totalUnits } = system;
  //       const ratePerUnit = flowrate / totalUnits;
  //       console.log("ratePerUnit", ratePerUnit);
  //       const formatted =  convertFlowRate(ratePerUnit.toString(), timeUnit);
  //       console.log("formatted", formatted);
  //       flowrateMap.set(system.id, formatted);
  //     });
  //     //setFlowratePerUnitInProgram(flowrateMap);
  //   };
  //   fetchFlowratePerUnit();
  // }, []);

  return (
    <div>
      <div className="absolute top-4 right-4">
        <div className="inline-flex rounded-md shadow-sm">
          <button
            onClick={() => setTimeUnit('day')}
            className={`px-3 py-1.5 text-xs font-medium rounded-l-md border ${
              timeUnit === 'day'
                ? 'bg-gray-100 text-gray-700 border-gray-300'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            per day
          </button>
          <button
            onClick={() => setTimeUnit('month')}
            className={`px-3 py-1.5 text-xs font-medium rounded-r-md border-t border-r border-b ${
              timeUnit === 'month'
                ? 'bg-gray-100 text-gray-700 border-gray-300'
                : 'bg-white text-gray-500 border-gray-200 hover:bg-gray-50'
            }`}
          >
            per month
          </button>
        </div>
      </div>

      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-100">
          <tr>
            <th scope="col" className="px-3 py-3.5 text-left text-sm font-semibold text-gray-900 w-60">
              Program
            </th>
            {dataList.map((data, index) => (
              <React.Fragment key={`header-${index}`}>
                <th colSpan={2} scope="col" className="px-3 py-3.5 text-center text-sm font-semibold text-gray-900 border-l w-48 relative">
                  <button
                    onClick={() => onRemoveUser(data.address)}
                    className="absolute top-1/2 -translate-y-1/2 right-1 p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-50"
                    title="Remove user"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                  <div className="flex items-center justify-center">
                    <UserProfileDisplay 
                      address={data.address}
                      profile={userProfiles[data.address]}
                      onAddressCopy={onAddressCopy}
                      showAvatar={false}
                    />
                  </div>
                </th>
              </React.Fragment>
            ))}
          </tr>
          {/* Add subheader row for column labels */}
          <tr className="bg-gray-50">
            <th scope="col" className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-60">
              &nbsp;
            </th>
            {dataList.map((_, index) => (
              <React.Fragment key={`subheader-${index}`}>
                <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l w-24">
                  Points
                </th>
                <th scope="col" className="px-3 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                  Flowrate
                  <div className="text-xxs font-normal">SUP/{timeUnit}</div>
                </th>
              </React.Fragment>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200 bg-white">
          {/* Rows for each point system */}
          {pointSystemIds.map(pointSystemId => (
            <React.Fragment key={`system-fragment-${pointSystemId}`}>
              <tr key={`system-${pointSystemId}`} className={`${dataList.some(data => !!expandedActivities[`${pointSystemId}-${data.address}`]) ? 'bg-blue-50 border-l-4 border-l-blue-300' : ''}`}>
                <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 truncate w-60">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div 
                        className="w-3 h-3 rounded-full mr-2 flex-shrink-0" 
                        style={{ backgroundColor: getPointSystemColor(pointSystemId) }}
                      ></div>
                      <span>{allPointSystems[pointSystemId]}</span>
                    </div>
                    
                    {/* Add expand/collapse button */}
                    <button
                      onClick={() => loadStackActivityForProgram(pointSystemId)}
                      className={`ml-2 focus:outline-none ${dataList.some(data => !!expandedActivities[`${pointSystemId}-${data.address}`]) ? 'text-blue-500 hover:text-blue-700' : 'text-gray-400 hover:text-gray-600'}`}
                      title={dataList.some(data => !!expandedActivities[`${pointSystemId}-${data.address}`]) ? "Collapse activities" : "Expand activities"}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                        {dataList.some(data => !!expandedActivities[`${pointSystemId}-${data.address}`]) ? (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 12H6" />
                        ) : (
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                        )}
                      </svg>
                    </button>
                  </div>
                </td>
                
                {/* Data cells for each address */}
                {dataList.map((data, addressIndex) => {
                  const item = findEligibilityItem(data, pointSystemId);
                  if (!item) {
                    // No data for this point system for this address
                    return (
                      <React.Fragment key={`empty-${addressIndex}-${pointSystemId}`}>
                        <td className="px-3 py-4 text-sm text-gray-500 text-right border-l w-24">-</td>
                        <td className="px-3 py-4 text-sm text-gray-500 text-right w-24">-</td>
                      </React.Fragment>
                    );
                  }
                  
                  // Calculate claimed and unclaimed flowrates
                  const claimedProportion = item.points > 0 ? Math.min(item.claimedAmount / item.points, 1) : 0;
                  
                  // Use BigInt for precision
                  const itemFlowRateBigInt = BigInt(item.estimatedFlowRate || '0');
                  const scaleFactor = BigInt(1000000); // 6 decimal places for proportion
                  const claimedProportionFixed = BigInt(Math.floor(claimedProportion * Number(scaleFactor)));
                  
                  const claimedFlowrateBigInt = (itemFlowRateBigInt * claimedProportionFixed) / scaleFactor;
                  const unclaimedFlowrateBigInt = item.needToClaim ? (itemFlowRateBigInt - claimedFlowrateBigInt) : BigInt(0);
                  
                  const claimedFlowrateStr = claimedFlowrateBigInt.toString();
                  const unclaimedFlowrateStr = unclaimedFlowrateBigInt.toString();
                  
                  const unclaimedPoints = getUnclaimedPoints(item.points, item.claimedAmount);
                  
                  // Check if this address has expanded activities
                  const activityKey = `${pointSystemId}-${data.address}`;
                  const hasExpandedActivities = !!expandedActivities[activityKey];
                  
                  return (
                    <React.Fragment key={`data-${addressIndex}-${pointSystemId}`}>
                      <td className="px-3 py-4 text-sm text-right font-mono border-l w-24 relative">
                        <div className="flex flex-col items-end">
                          <div>
                            <span className="text-gray-900">{item.claimedAmount.toLocaleString()}</span>
                          </div>
                          {unclaimedPoints > 0 && (
                            <div className="text-xs text-yellow-600 mt-0.5 block">
                              +{unclaimedPoints.toLocaleString()}
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-3 py-4 text-sm text-right w-24">
                        <div className="flex flex-col items-end">
                          {/* Always show claimed flowrate, even if it's zero */}
                          <div className="font-mono text-gray-900 relative group">
                            {convertFlowRate(claimedFlowrateStr, timeUnit)}
                            <div className="absolute bottom-full mb-1 right-0 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                              SUP/{timeUnit}
                            </div>
                          </div>
                          
                          {/* Show unclaimed flowrate on a new line when it exists */}
                          {unclaimedFlowrateBigInt > BigInt(0) && (
                            <div className="font-mono text-yellow-600 text-sm relative group">
                              +{convertFlowRate(unclaimedFlowrateStr, timeUnit)}
                              <div className="absolute bottom-full mb-1 right-0 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                SUP/{timeUnit}
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </React.Fragment>
                  );
                })}
              </tr>
              
              {/* Activity Rows - conditionally rendered */}
              {(() => {
                // First check if any address for this point system has activity data
                const hasAnyActivityData = dataList.some(data => {
                  const activityKey = `${pointSystemId}-${data.address}`;
                  const activityData = expandedActivities[activityKey];
                  return activityData?.data?.aggregates?.length > 0;
                });

                // Check if all expanded addresses are loaded (not in loading state)
                const expandedAndLoaded = dataList.filter(data => {
                  const activityKey = `${pointSystemId}-${data.address}`;
                  const activityData = expandedActivities[activityKey];
                  return activityData && !activityData.isLoading;
                });

                // Only show the "no activities" message if there are expanded addresses, 
                // they're all loaded, and none have activities
                if (expandedAndLoaded.length > 0 && !hasAnyActivityData) {
                  return (
                    <tr key={`activity-empty-all-${pointSystemId}`} className="border-t border-gray-100">
                      <td colSpan={1 + 2 * dataList.length} className="px-4 py-2 text-sm text-gray-500 bg-blue-50/50">
                        <div className="flex items-center pl-8">
                          No activities found for any user
                        </div>
                      </td>
                    </tr>
                  );
                }

                // Map over addresses to show loading states or activities
                return dataList.map((data, addressIndex) => {
                  const activityKey = `${pointSystemId}-${data.address}`;
                  const activityData = expandedActivities[activityKey];
                  
                  // Skip if not expanded
                  if (!activityData) return null;
                  
                  const item = findEligibilityItem(data, pointSystemId);
                  if (!item) return null;
                  
                  // Show loading state
                  if (activityData.isLoading) {
                    return (
                      <tr key={`activity-loading-${activityKey}`} className="border-t border-gray-100">
                        <td colSpan={1 + 2 * dataList.length} className="px-4 py-2 text-sm text-gray-500 bg-blue-50/50">
                          <div className="flex items-center pl-8">
                            <svg className="animate-spin h-4 w-4 mr-2 text-blue-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Loading activities for {data.address.substring(0, 6)}...{data.address.substring(data.address.length - 4)}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  
                  // Show error state
                  if (activityData.error) {
                    return (
                      <tr key={`activity-error-${activityKey}`} className="border-t border-gray-100">
                        <td colSpan={1 + 2 * dataList.length} className="px-4 py-2 text-sm text-red-500 bg-blue-50/50">
                          <div className="flex items-center pl-8">
                            <svg className="h-4 w-4 mr-2 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            {activityData.error} for {data.address.substring(0, 6)}...{data.address.substring(data.address.length - 4)}
                          </div>
                        </td>
                      </tr>
                    );
                  }
                  
                  // Skip if no activities for this address
                  if (!activityData.data?.aggregates?.length) return null;
                  
                  // Show activities
                  return activityData.data.aggregates.map((activity, activityIndex) => {
                    // Calculate flowrate for this activity based on points proportion
                    const activityFlowrateStr = calculateActivityFlowrate(
                      activity.totalPoints,
                      item.points || 1, // Prevent division by zero if points is 0
                      item.estimatedFlowRate
                    );
                    
                    return (
                      <tr 
                        key={`activity-${activityKey}-${activityIndex}`}
                        className={`bg-blue-50/50 ${activityIndex === 0 ? 'border-t border-gray-100' : ''}`}
                      >
                        <td className="py-2 pl-12 pr-3 text-xs text-gray-700 w-60">
                          <div className="flex items-center">
                            <div className="w-5 border-l-2 border-b-2 border-gray-300 h-3 mr-2"></div>
                            <span className="font-medium">{activity.eventType}</span>
                          </div>
                        </td>
                        
                        {dataList.map((d, dIndex) => {
                          // Only show activity details for the matching address
                          if (dIndex !== addressIndex) {
                            return (
                              <React.Fragment key={`activity-empty-cell-${activityKey}-${activityIndex}-${dIndex}`}>
                                <td className="px-3 py-2 text-xs text-gray-400 text-right border-l w-24">-</td>
                                <td className="px-3 py-2 text-xs text-gray-400 text-right w-24">-</td>
                              </React.Fragment>
                            );
                          }
                          
                          return (
                            <React.Fragment key={`activity-data-${activityKey}-${activityIndex}-${dIndex}`}>
                              <td className="px-3 py-2 text-xs text-right font-mono border-l w-24">
                                {activity.totalPoints.toLocaleString()}
                              </td>
                              <td className="px-3 py-2 text-xs text-right font-mono w-24">
                                {convertFlowRate(activityFlowrateStr, timeUnit)}
                              </td>
                            </React.Fragment>
                          );
                        })}
                      </tr>
                    );
                  });
                });
              })()}
            </React.Fragment>
          ))}
          
          {/* Total row at the bottom */}
          <tr className="bg-gray-100 border-t-2 border-gray-300">
            <td className="py-4 pl-4 pr-3 text-sm font-semibold text-gray-900 sm:pl-6">
              <strong>TOTAL</strong>
            </td>
            
            {/* Total for each address */}
            {dataList.map((data, addressIndex) => {
              // Calculate flowrate data for pie chart
              const flowrateData = data.eligibility
                .filter(item => BigInt(item.estimatedFlowRate) !== BigInt(0))
                .map(item => ({
                  pointSystemId: item.pointSystemId,
                  flowrate: calculatePercentage(item.estimatedFlowRate, addressFlowrates[addressIndex].totalFlowrate)
                }))
                .sort((a, b) => b.flowrate - a.flowrate);

              return (
                <React.Fragment key={`total-${addressIndex}`}>
                  <td className="px-3 py-4 text-right border-l" colSpan={2}>
                    <div className="flex justify-end">
                      {flowrateData.length > 0 && (
                        <FlowratePieChart 
                          data={flowrateData}
                          pointSystemColors={POINT_SYSTEM_COLORS}
                          pointSystemNames={allPointSystems}
                        />
                      )}
                      <div className="flex flex-col items-end self-center ml-1">
                        {/* And in the totals row */}
                        <div className="flex flex-col items-end">
                          <div className="flex items-center">
                            <strong className="text-gray-900 font-mono relative group">
                              {convertFlowRate(addressFlowrates[addressIndex].totalClaimedFlowrate, timeUnit)}
                              <div className="absolute bottom-full mb-1 right-0 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                SUP/{timeUnit}
                              </div>
                            </strong>
                          </div>
                          
                          {/* Show unclaimed total flowrate on a new line when it exists */}
                          {addressFlowrates[addressIndex].totalUnclaimedFlowrate !== '0' && (
                            <div className="flex items-center mt-1">
                              <strong className="text-yellow-600 font-mono text-sm relative group">
                                +{convertFlowRate(addressFlowrates[addressIndex].totalUnclaimedFlowrate, timeUnit)}
                                <div className="absolute bottom-full mb-1 right-0 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                                  SUP/{timeUnit}
                                </div>
                              </strong>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                </React.Fragment>
              );
            })}
          </tr>
        </tbody>
      </table>
      
      {/* Warning messages */}
      <div className="mt-4">
        {dataList.some(data => data.claimNeeded) && (
          <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mt-2">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm text-yellow-700">
                  <strong>Yellow numbers</strong> indicate potential additional flowrate if points are claimed. Claim your tokens to receive this flowrate!
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    
    </div>
  );
};

export default FlowrateBreakdown;