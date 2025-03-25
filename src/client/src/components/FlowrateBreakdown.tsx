import React, { useState, useMemo } from 'react';
import { AddressEligibility, PointSystemEligibility } from '../types';
import UserProfileDisplay, { UserProfile } from '../components/UserProfileDisplay';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

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

const FlowrateBreakdown = ({ 
  dataList, 
  userProfiles, 
  onAddressCopy, 
  onRemoveUser,
}: FlowrateBreakdownProps) => {
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('month');
  
  // Early return if no data
  if (!dataList.length) return null;
  
  // Get all unique point systems across all addresses
  const allPointSystems = getAllPointSystems(dataList);
  const pointSystemIds = Object.keys(allPointSystems).map(Number);
  
  // Calculate claimed and unclaimed flowrates
  const addressFlowrates = useMemo(() => {
    return dataList.map(data => {
      // Calculate flowrates for each address
      let totalClaimedFlowrate = 0;
      let totalUnclaimedFlowrate = 0;
      
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
        const claimedFlowrate = item.estimatedFlowRate * claimedProportion;
        
        // Calculate unclaimed (potential) flowrate
        const unclaimedFlowrate = item.needToClaim ? (item.estimatedFlowRate - claimedFlowrate) : 0;
        
        totalClaimedFlowrate += claimedFlowrate;
        totalUnclaimedFlowrate += unclaimedFlowrate;
      });
      
      return {
        totalClaimedFlowrate,
        totalUnclaimedFlowrate,
        totalFlowrate: totalClaimedFlowrate + totalUnclaimedFlowrate
      };
    });
  }, [dataList]);
  
  // Convert wei/second to unit/day or unit/month without K/M notation
  const convertFlowRate = (weiPerSecond: number, unit: TimeUnit): string => {
    if (weiPerSecond === 0) return '0';
    
    // Convert wei to units (divide by 10^18)
    const unitsPerSecond = weiPerSecond / 10**18;
    
    // Convert seconds to days or months
    const multiplier = unit === 'day' ? 86400 : 2592000; // 86400 seconds in a day, ~2592000 in a month (30 days)
    const value = unitsPerSecond * multiplier;
    
    // Format the number without K/M notation
    if (value < 0.0001) {
      return value.toExponential(2);
    } else if (value < 1) {
      return value.toFixed(2);
    } else if (value < 1000) {
      return value.toFixed(2);
    } else {
      // Return the full number with commas for thousands
      return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
    }
  };

  // Get percentage of each program's flowrate relative to total
  const calculatePercentage = (flowRate: number, totalFlowRate: number) => {
    if (totalFlowRate === 0 || flowRate === 0) return 0;
    return (flowRate / totalFlowRate) * 100;
  };

  // Calculate unclaimed points
  const getUnclaimedPoints = (points: number, claimed: number): number => {
    return Math.max(0, points - claimed);
  };

  // Find eligibility item for a specific point system
  const findEligibilityItem = (data: AddressEligibility, pointSystemId: number): PointSystemEligibility | undefined => {
    return data.eligibility.find(item => item.pointSystemId === pointSystemId);
  };

  return (
    <div className="overflow-x-auto">
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
                    />
                  </div>
                </th>
              </React.Fragment>
            ))}
          </tr>
        </thead>

        <tbody className="divide-y divide-gray-200 bg-white">
          {/* Rows for each point system */}
          {pointSystemIds.map(pointSystemId => (
            <tr key={`system-${pointSystemId}`}>
              <td className="py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6 truncate w-60">
                <div className="flex items-center">
                  <div 
                    className="w-3 h-3 rounded-full mr-2 flex-shrink-0" 
                    style={{ backgroundColor: getPointSystemColor(pointSystemId) }}
                  ></div>
                  <span>{allPointSystems[pointSystemId]}</span>
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
                const claimedFlowrate = item.estimatedFlowRate * claimedProportion;
                const unclaimedFlowrate = item.needToClaim ? (item.estimatedFlowRate - claimedFlowrate) : 0;
                const unclaimedPoints = getUnclaimedPoints(item.points, item.claimedAmount);
                
                return (
                  <React.Fragment key={`data-${addressIndex}-${pointSystemId}`}>
                    <td className="px-3 py-4 text-sm text-right font-mono border-l w-24">
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
                        <div className="font-mono text-gray-900">
                          {convertFlowRate(claimedFlowrate, timeUnit)}
                        </div>
                        
                        {/* Show unclaimed flowrate on a new line when it exists */}
                        {unclaimedFlowrate > 0 && (
                          <div className="font-mono text-yellow-600 text-sm">
                            +{convertFlowRate(unclaimedFlowrate, timeUnit)}
                          </div>
                        )}
                      </div>
                    </td>
                  </React.Fragment>
                );
              })}
            </tr>
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
                .filter(item => item.estimatedFlowRate > 0)
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
                        {/* Always show claimed total flowrate, even if it's zero */}
                        <div className="flex items-center">
                          <strong className="text-gray-900 font-mono">
                            {convertFlowRate(addressFlowrates[addressIndex].totalClaimedFlowrate, timeUnit)}
                          </strong>
                          <span className="text-xs text-gray-500 ml-1">/{timeUnit}</span>
                        </div>
                        
                        {/* Show unclaimed total flowrate on a new line when it exists */}
                        {addressFlowrates[addressIndex].totalUnclaimedFlowrate > 0 && (
                          <div className="flex items-center">
                            <strong className="text-yellow-600 font-mono text-sm">
                              +{convertFlowRate(addressFlowrates[addressIndex].totalUnclaimedFlowrate, timeUnit)}
                            </strong>
                            <span className="text-xs text-gray-500 ml-1">/{timeUnit}</span>
                          </div>
                        )}
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