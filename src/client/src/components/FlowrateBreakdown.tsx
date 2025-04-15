import React, { useState, useMemo, useEffect, useCallback, useRef, useContext } from 'react';
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
  timeUnit?: TimeUnit;
  onTimeUnitChange?: (unit: TimeUnit) => void;
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

// Create a context to store loading state outside component render cycles
const LoadingContext = React.createContext<{
  queueRequest: (fn: () => Promise<void>) => void;
}>({
  queueRequest: () => Promise.resolve(),
});

// Simplified provider component to wrap around the main component
const LoadingProvider: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const requestQueueRef = useRef<Array<() => Promise<void>>>([]);
  const isProcessingQueueRef = useRef<boolean>(false);
  
  const processQueue = useCallback(async () => {
    if (isProcessingQueueRef.current) return;
    
    isProcessingQueueRef.current = true;
    
    try {
      while (requestQueueRef.current.length > 0) {
        const request = requestQueueRef.current.shift();
        if (request) {
          try {
            await request();
          } catch (error) {
            console.error("Error processing queued request:", error);
          }
          
          // Add a small delay between requests
          await new Promise(resolve => setTimeout(resolve, 200));
        }
      }
    } finally {
      isProcessingQueueRef.current = false;
    }
  }, []);
  
  const queueRequest = useCallback((fn: () => Promise<void>) => {
    requestQueueRef.current.push(fn);
    processQueue();
  }, [processQueue]);
  
  return (
    <LoadingContext.Provider value={{ queueRequest }}>
      {children}
    </LoadingContext.Provider>
  );
};

const FlowrateBreakdown = ({ 
  dataList, 
  userProfiles, 
  onAddressCopy, 
  onRemoveUser,
  onAddAddress,
  isLoading,
  timeUnit: externalTimeUnit,
  onTimeUnitChange
}: FlowrateBreakdownProps) => {
  // Context and refs
  const { queueRequest } = useContext(LoadingContext);
  const abortControllersRef = useRef<Map<string, AbortController>>(new Map());
  const notificationRef = useRef<HTMLDivElement>(null);
  
  // State
  const [internalTimeUnit, setInternalTimeUnit] = useState<TimeUnit>('month');
  const [expandedActivities, setExpandedActivities] = useState<ExpandedActivities>({});
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [showNotification, setShowNotification] = useState<string | null>(null);
  
  // Auto-cleanup on unmount
  useEffect(() => {
    return () => {
      abortControllersRef.current.forEach((controller) => {
        try { controller.abort(); } catch (err) { /* ignore */ }
      });
    };
  }, []);
  
  // Early return if no data
  if (!dataList.length) return null;
  
  // Derived data
  const allPointSystems = getAllPointSystems(dataList);
  const pointSystemIds = Object.keys(allPointSystems).map(Number);
  
  // Calculate flowrates only when dataList changes
  const addressFlowrates = dataList.map(data => {
    // Calculate flowrates for each address
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
  });
  
  // Essential activity loading function - simplified and isolated
  const loadActivityData = (address: string, pointSystemId: number, forceCollapse = false) => {
    const activityKey = `${pointSystemId}-${address}`;
    
    // Handle collapse case
    if ((expandedActivities[activityKey]?.data && !forceCollapse) || forceCollapse) {
      // Cancel any in-flight request
      if (abortControllersRef.current.has(activityKey)) {
        try {
          abortControllersRef.current.get(activityKey)?.abort();
          abortControllersRef.current.delete(activityKey);
        } catch (err) { /* ignore */ }
      }
      
      // Update state in one go
      setExpandedActivities(prev => {
        const newState = { ...prev };
        delete newState[activityKey];
        return newState;
      });
      
      return;
    }
    
    // Avoid duplicate requests
    if (expandedActivities[activityKey]?.isLoading) return;
    
    // Set loading state
    setExpandedActivities(prev => ({
      ...prev,
      [activityKey]: {
        isLoading: true,
        error: null,
        data: null
      }
    }));
    
    // Add to queue
    queueRequest(async () => {
      const controller = new AbortController();
      abortControllersRef.current.set(activityKey, controller);
      
      try {
        const response = await axios.get(`/stack-activity?address=${address}&point-system-id=${pointSystemId}`, {
          signal: controller.signal
        });
        
        setExpandedActivities(prev => ({
          ...prev,
          [activityKey]: {
            isLoading: false,
            error: null,
            data: response.data
          }
        }));
      } catch (error) {
        if (axios.isCancel(error)) return;
        
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
      } finally {
        abortControllersRef.current.delete(activityKey);
      }
    });
  };
  
  // Programmatically load/unload activities for all addresses in a program
  const toggleProgramActivities = async (pointSystemId: number) => {
    const isAnyExpanded = dataList.some(data => 
      expandedActivities[`${pointSystemId}-${data.address}`]?.data
    );
    
    if (isAnyExpanded) {
      // Collapse all
      dataList.forEach(data => {
        loadActivityData(data.address, pointSystemId, true);
      });
    } else {
      // Expand all sequentially with delay
      for (let i = 0; i < dataList.length; i++) {
        loadActivityData(dataList[i].address, pointSystemId);
        if (i < dataList.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 300));
        }
      }
    }
  };
  
  // Row click handler - simplified
  const handleRowClick = (rowId: string) => {
    // If selecting activity row that needs loading
    if (rowId.startsWith('activity-') && rowId !== selectedRowId) {
      const parts = rowId.split('-');
      if (parts.length >= 4) {
        const pointSystemId = parseInt(parts[1]);
        const addressIndex = parseInt(parts[2]);
        
        if (dataList[addressIndex]) {
          const address = dataList[addressIndex].address;
          const activityKey = `${pointSystemId}-${address}`;
          
          if (!expandedActivities[activityKey]?.data) {
            loadActivityData(address, pointSystemId);
          }
        }
      }
    }
    
    // Simply toggle selection
    setSelectedRowId(prevId => prevId === rowId ? null : rowId);
  };

  // Handle time unit changes
  const handleTimeUnitChange = (newTimeUnit: TimeUnit) => {
    if (onTimeUnitChange) {
      onTimeUnitChange(newTimeUnit);
    } else {
      setInternalTimeUnit(newTimeUnit);
    }
  };
  
  // Handle notifications
  const showTemporaryNotification = (message: string) => {
    setShowNotification(message);
    setTimeout(() => {
      setShowNotification(null);
    }, 2000);
  };
  
  // Convert flowrate for display
  const convertFlowRate = (weiPerSecondStr: string, unit: TimeUnit): string => {
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
  const calculatePercentage = (flowRateStr: string, totalFlowRateStr: string) => {
    const flowRate = BigInt(flowRateStr || '0');
    const totalFlowRate = BigInt(totalFlowRateStr || '0');
    
    if (totalFlowRate === BigInt(0) || flowRate === BigInt(0)) return 0;
    
    const precisionFactor = BigInt(10000);
    return Number((flowRate * precisionFactor) / totalFlowRate) / 100;
  };
  
  // Calculate unclaimed points
  const getUnclaimedPoints = (points: number, claimed: number): number => {
    return Math.max(0, points - claimed);
  };
  
  // Find eligibility item
  const findEligibilityItem = (data: AddressEligibility, pointSystemId: number): PointSystemEligibility | undefined => {
    return data.eligibility.find(item => item.pointSystemId === pointSystemId);
  };
  
  // Calculate flowrate for individual activity
  const calculateActivityFlowrate = (activityPoints: number, totalPoints: number, totalFlowrate: string): string => {
    if (totalPoints === 0 || activityPoints === 0) return '0';
    
    const proportion = activityPoints / totalPoints;
    const flowrateBigInt = BigInt(totalFlowrate || '0');
    
    const scaleFactor = BigInt(1000000);
    const proportionScaled = BigInt(Math.floor(proportion * Number(scaleFactor)));
    
    const activityFlowrateBigInt = (flowrateBigInt * proportionScaled) / scaleFactor;
    return activityFlowrateBigInt.toString();
  };

  // Use either external or internal time unit
  const timeUnit = externalTimeUnit !== undefined ? externalTimeUnit : internalTimeUnit;

  // Now render the UI
  return (
    <div className="relative">
      {/* Simple notification with fade classes */}
      {showNotification && (
        <div 
          ref={notificationRef}
          className="fixed top-16 right-4 bg-green-500 text-white px-4 py-2 rounded shadow-lg z-50 opacity-100 transition-opacity duration-300"
        >
          {showNotification}
        </div>
      )}
      
      <div className="flex justify-center items-center">
        <div className="overflow-x-auto w-fit">
          <table className="divide-y divide-gray-200 table-auto border-collapse mx-auto">
            <colgroup>
              <col className="min-w-[350px] w-auto" /> {/* Program column */}
              {dataList.map((_, index) => (
                <React.Fragment key={`cols-${index}`}>
                  <col className="min-w-[200px] w-auto" /> {/* Points column */}
                  <col className="min-w-[200px] w-auto" /> {/* Flowrate column */}
                </React.Fragment>
              ))}
            </colgroup>
            <thead>
              {/* User addresses row */}
              <tr className="bg-gray-100">
                <th scope="col" className="px-4 py-3.5 text-left text-sm font-semibold text-gray-900 whitespace-nowrap">
                  &nbsp;
                </th>
                {dataList.map((data, index) => (
                  <th key={`user-${index}`} colSpan={2} scope="col" className="px-4 py-3.5 text-center text-sm font-semibold text-gray-900 border-l relative whitespace-nowrap">
                    <div className="flex items-center justify-center">
                      <UserProfileDisplay 
                        address={data.address}
                        profile={userProfiles[data.address]}
                        onAddressCopy={onAddressCopy}
                        showAvatar={false}
                      />
                      <button
                        onClick={() => onRemoveUser(data.address)}
                        className="absolute top-1/2 -translate-y-1/2 right-1 p-1 text-red-500 hover:text-red-700 rounded-full hover:bg-red-50"
                        title="Remove user"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </th>
                ))}
              </tr>
              {/* Column headers row - Program, Points, and Flowrate all on one level */}
              <tr className="bg-gray-50">
                <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                  Program
                </th>
                {dataList.map((_, index) => (
                  <React.Fragment key={`headers-${index}`}>
                    <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider border-l whitespace-nowrap">
                      Points
                    </th>
                    <th scope="col" className="px-4 py-2 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      Flowrate
                      <div className="text-xs font-normal">SUP/{timeUnit}</div>
                    </th>
                  </React.Fragment>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-gray-200 bg-white">
              {/* Rows for each point system */}
              {pointSystemIds.map(pointSystemId => (
                <React.Fragment key={`system-fragment-${pointSystemId}`}>
                  <tr 
                    key={`system-${pointSystemId}`} 
                    className={`${dataList.some(data => !!expandedActivities[`${pointSystemId}-${data.address}`]) ? 'bg-blue-50 border-l-4 border-l-blue-300' : ''} ${
                      selectedRowId === `system-${pointSystemId}` 
                        ? 'bg-indigo-100 hover:bg-indigo-200' 
                        : 'hover:bg-gray-50'
                    } cursor-pointer transition-colors duration-150`}
                    onClick={() => handleRowClick(`system-${pointSystemId}`)}
                  >
                    <td className="py-3 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 whitespace-nowrap">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center overflow-hidden">
                          <div 
                            className="w-3 h-3 rounded-full mr-2 flex-shrink-0" 
                            style={{ backgroundColor: getPointSystemColor(pointSystemId) }}
                          ></div>
                          <span className="truncate max-w-[200px] inline-block">{allPointSystems[pointSystemId]}</span>
                        </div>
                        
                        {/* Add expand/collapse button */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation(); // Prevent row click when clicking the button
                            toggleProgramActivities(pointSystemId);
                          }}
                          className={`ml-2 p-1.5 rounded-full focus:outline-none flex-shrink-0 ${
                            dataList.some(data => !!expandedActivities[`${pointSystemId}-${data.address}`]) 
                              ? 'text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100' 
                              : 'text-green-500 hover:text-green-700 bg-green-50 hover:bg-green-100'
                          }`}
                          title={dataList.some(data => !!expandedActivities[`${pointSystemId}-${data.address}`]) ? "Collapse activities" : "Expand activities"}
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
                            <td className="px-4 py-3 text-sm text-gray-500 text-right border-l whitespace-nowrap">-</td>
                            <td className="px-4 py-3 text-sm text-gray-500 text-right whitespace-nowrap">-</td>
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
                      
                      return (
                        <React.Fragment key={`data-${addressIndex}-${pointSystemId}`}>
                          <td className="px-4 py-3 text-sm text-right font-mono border-l whitespace-nowrap">
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
                          <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
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
                  {dataList.some(data => expandedActivities[`${pointSystemId}-${data.address}`]) && 
                    (() => {
                      // First check if any address for this point system has activity data
                      const hasAnyActivityData = dataList.some(data => {
                        const activityKey = `${pointSystemId}-${data.address}`;
                        const activityData = expandedActivities[activityKey];
                        return !!activityData?.data?.aggregates && activityData.data.aggregates.length > 0;
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

                      // Collect loading states first
                      const loadingStates = dataList.map((data, addressIndex) => {
                        const activityKey = `${pointSystemId}-${data.address}`;
                        const activityData = expandedActivities[activityKey];
                        
                        if (!activityData || !activityData.isLoading) return null;
                        
                        const loadingRowId = `activity-loading-${activityKey}`;
                        return (
                          <tr 
                            key={loadingRowId} 
                            className={`border-t border-gray-100 ${
                              selectedRowId === loadingRowId 
                                ? 'bg-indigo-100 hover:bg-indigo-200' 
                                : 'bg-blue-50/50 hover:bg-blue-100/50'
                            } cursor-pointer transition-colors duration-150`}
                            onClick={() => handleRowClick(loadingRowId)}
                          >
                            <td colSpan={1 + 2 * dataList.length} className="px-4 py-2 text-sm text-gray-500">
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
                      }).filter(Boolean);

                      // Collect error states
                      const errorStates = dataList.map((data, addressIndex) => {
                        const activityKey = `${pointSystemId}-${data.address}`;
                        const activityData = expandedActivities[activityKey];
                        
                        if (!activityData || !activityData.error) return null;
                        
                        const errorRowId = `activity-error-${activityKey}`;
                        return (
                          <tr 
                            key={errorRowId} 
                            className={`border-t border-gray-100 ${
                              selectedRowId === errorRowId 
                                ? 'bg-red-200 hover:bg-red-300' 
                                : 'bg-red-50 hover:bg-red-100'
                            } cursor-pointer transition-colors duration-150`}
                            onClick={() => handleRowClick(errorRowId)}
                          >
                            <td colSpan={1 + 2 * dataList.length} className="px-4 py-2 text-sm text-red-500">
                              <div className="flex items-center pl-8">
                                <svg className="h-4 w-4 mr-2 text-red-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                </svg>
                                Error loading activities for {data.address.substring(0, 6)}...{data.address.substring(data.address.length - 4)}
                              </div>
                            </td>
                          </tr>
                        );
                      }).filter(Boolean);

                      // Render loading and error states first if any
                      if (loadingStates.length > 0 || errorStates.length > 0) {
                        return [...loadingStates, ...errorStates];
                      }

                      // Create a map of all unique activities across all addresses
                      const uniqueActivities = new Map<string, { 
                        eventType: string, 
                        addressData: Map<number, { 
                          points: number, 
                          flowrate: string 
                        }> 
                      }>();

                      // Collect all activities from all users
                      dataList.forEach((data, addressIndex) => {
                        const activityKey = `${pointSystemId}-${data.address}`;
                        const activityData = expandedActivities[activityKey]?.data;
                        const item = findEligibilityItem(data, pointSystemId);
                        
                        if (!activityData?.aggregates || !item) return;
                        
                        activityData.aggregates.forEach(activity => {
                          const eventType = activity.eventType;
                          const activityFlowrateStr = calculateActivityFlowrate(
                            activity.totalPoints,
                            item.points || 1,
                            item.estimatedFlowRate
                          );
                          
                          if (!uniqueActivities.has(eventType)) {
                            uniqueActivities.set(eventType, {
                              eventType,
                              addressData: new Map()
                            });
                          }
                          
                          uniqueActivities.get(eventType)!.addressData.set(addressIndex, {
                            points: activity.totalPoints,
                            flowrate: activityFlowrateStr
                          });
                        });
                      });

                      // Now render a single row for each unique activity
                      return Array.from(uniqueActivities.values()).map((activityData, activityIndex) => {
                        const activityRowId = `activity-${pointSystemId}-${activityData.eventType}-${activityIndex}`;
                        
                        return (
                          <tr 
                            key={activityRowId}
                            className={`${activityIndex === 0 ? 'border-t border-gray-100' : ''} ${
                              selectedRowId === activityRowId 
                                ? 'bg-indigo-100 hover:bg-indigo-200' 
                                : 'bg-blue-50/50 hover:bg-blue-100/50'
                            } cursor-pointer transition-colors duration-150`}
                            onClick={() => handleRowClick(activityRowId)}
                          >
                            <td className="py-2 pl-12 pr-3 text-xs text-gray-700">
                              <div className="flex items-center">
                                <div className="w-5 border-l-2 border-b-2 border-gray-300 h-3 mr-2"></div>
                                <span className="font-medium">{activityData.eventType}</span>
                              </div>
                            </td>
                            
                            {dataList.map((_, dIndex) => {
                              const addressData = activityData.addressData.get(dIndex);
                              
                              if (!addressData) {
                                return (
                                  <React.Fragment key={`activity-empty-cell-${activityData.eventType}-${dIndex}`}>
                                    <td className="px-4 py-2 text-xs text-gray-400 text-right border-l whitespace-nowrap">-</td>
                                    <td className="px-4 py-2 text-xs text-gray-400 text-right whitespace-nowrap">-</td>
                                  </React.Fragment>
                                );
                              }
                              
                              return (
                                <React.Fragment key={`activity-data-${activityData.eventType}-${dIndex}`}>
                                  <td className="px-4 py-2 text-xs text-right font-mono border-l whitespace-nowrap">
                                    {addressData.points.toLocaleString()}
                                  </td>
                                  <td className="px-4 py-2 text-xs text-right font-mono whitespace-nowrap">
                                    {convertFlowRate(addressData.flowrate, timeUnit)}
                                  </td>
                                </React.Fragment>
                              );
                            })}
                          </tr>
                        );
                      });
                    })()
                  }
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

// Wrap the component with the loading provider
export default (props: FlowrateBreakdownProps) => (
  <LoadingProvider>
    <FlowrateBreakdown {...props} />
  </LoadingProvider>
);