import { useState } from 'react';
import { AddressEligibility } from '../types'

interface FlowrateBreakdownProps {
  data: AddressEligibility
}

type TimeUnit = 'day' | 'month';

const FlowrateBreakdown = ({ data }: FlowrateBreakdownProps) => {
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('day');
  
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
      return value.toExponential(4);
    } else if (value < 1) {
      return value.toFixed(6);
    } else if (value < 1000) {
      return value.toFixed(4);
    } else {
      // Return the full number with commas for thousands
      return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
    }
  }

  // Get percentage of each program's flowrate relative to total
  const calculatePercentage = (flowRate: number, totalFlowRate: number) => {
    if (totalFlowRate === 0 || flowRate === 0) return 0
    return (flowRate / totalFlowRate) * 100
  }

  // Calculate unclaimed points
  const getUnclaimedPoints = (points: number, claimed: number): number => {
    return Math.max(0, points - claimed);
  };

  // Check if any items have unclaimed points
  const hasUnclaimedPoints = data.eligibility.some(item => 
    getUnclaimedPoints(item.points, item.claimedAmount) > 0
  );

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-lg font-medium text-gray-900">
          Flowrate Breakdown for <span className="font-mono">{data.address}</span>
        </h2>
        
        {!data.hasAllocations && (
          <div className="mt-2 text-sm text-gray-500">
            This address has no allocations in any point system.
          </div>
        )}
        
        {data.hasAllocations && (
          <div>
            <div className="mt-4 flex items-center">
              <div className="mr-4 text-sm text-gray-500">
                {data.claimNeeded ? (
                  <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4">
                    <div className="flex">
                      <div className="flex-shrink-0">
                        <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <div className="ml-3">
                        <p className="text-sm text-yellow-700">
                          This address needs to claim tokens to receive the full flowrate.
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div>
                    Total estimated flowrate: <span className="font-medium">{convertFlowRate(data.totalFlowRate || 0, timeUnit)}</span> SUP/{timeUnit}
                  </div>
                )}
              </div>
              
              <div className="ml-auto">
                <div className="inline-flex items-center rounded-md shadow-sm">
                  <button
                    type="button"
                    className={`relative inline-flex items-center rounded-l-md px-3 py-2 text-sm font-semibold ${
                      timeUnit === 'day' 
                        ? 'bg-superfluid-blue text-white'
                        : 'bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setTimeUnit('day')}
                  >
                    Per Day
                  </button>
                  <button
                    type="button"
                    className={`relative -ml-px inline-flex items-center rounded-r-md px-3 py-2 text-sm font-semibold ${
                      timeUnit === 'month' 
                        ? 'bg-superfluid-blue text-white'
                        : 'bg-white text-gray-900 ring-1 ring-inset ring-gray-300 hover:bg-gray-50'
                    }`}
                    onClick={() => setTimeUnit('month')}
                  >
                    Per Month
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      
      {data.hasAllocations && (
        <div className="overflow-hidden shadow ring-1 ring-black ring-opacity-5 sm:rounded-lg">
          <table className="min-w-full divide-y divide-gray-300">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="py-3.5 pl-4 pr-3 text-left text-sm font-semibold text-gray-900 sm:pl-6">Point System</th>
                <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">
                  Points {hasUnclaimedPoints && "(Unclaimed)"}
                </th>
                <th scope="col" className="px-3 py-3.5 text-right text-sm font-semibold text-gray-900">Flowrate (SUP/{timeUnit})</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {data.eligibility.map((item) => {
                const unclaimedPoints = getUnclaimedPoints(item.points, item.claimedAmount);
                
                return (
                  <tr key={item.pointSystemId}>
                    <td className="whitespace-nowrap py-4 pl-4 pr-3 text-sm font-medium text-gray-900 sm:pl-6">
                      {item.pointSystemName}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right font-mono">
                      {item.points.toLocaleString()} {unclaimedPoints > 0 && (
                        <span className={`${item.needToClaim ? 'text-yellow-600' : 'text-gray-500'}`}>
                          ({unclaimedPoints.toLocaleString()})
                        </span>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-3 py-4 text-sm text-gray-500 text-right">
                      <div className="flex justify-end items-center">
                        <span className="font-mono text-black">
                          {convertFlowRate(item.estimatedFlowRate, timeUnit)}
                        </span>
                        {data.totalFlowRate && data.totalFlowRate > 0 && (
                          <span className="text-xs text-gray-400 tabular-nums font-mono" style={{ width: '4.2rem' }}>
                            ({calculatePercentage(item.estimatedFlowRate, data.totalFlowRate).toFixed(2)}%)
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

export default FlowrateBreakdown