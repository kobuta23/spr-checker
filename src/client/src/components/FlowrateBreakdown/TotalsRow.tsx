import React from 'react';
import { AddressEligibility } from '../../types';
import { calculatePercentage, convertFlowRate } from './utils';
import { TimeUnit } from './utils';
import FlowratePieChart from './FlowratePieChart';

interface TotalsRowProps {
  dataList: AddressEligibility[];
  addressFlowrates: Array<{
    totalClaimedFlowrate: string;
    totalUnclaimedFlowrate: string;
    totalFlowrate: string;
  }>;
  pointSystemNames: Record<number, string>;
  pointSystemColors: Record<number, string>;
  timeUnit: TimeUnit;
}

const TotalsRow: React.FC<TotalsRowProps> = ({
  dataList,
  addressFlowrates,
  pointSystemNames,
  pointSystemColors,
  timeUnit
}) => {
  return (
    <tr className="border-t-2 border-gray-300 bg-gray-50">
      <td className="py-4 pl-4 pr-3 text-sm font-bold text-gray-900 sm:pl-6 whitespace-nowrap">
        <div className="flex items-center">
          <span>Totals</span>
        </div>
      </td>
      
      {dataList.map((data, addressIndex) => {
        // Get the address flowrate data
        const flowrateData = addressFlowrates[addressIndex];
        
        // Prepare pie chart data
        const pieChartData = data.eligibility
          .filter(item => BigInt(item.estimatedFlowRate || '0') > BigInt(0))
          .map(item => ({
            pointSystemId: item.pointSystemId,
            flowrate: calculatePercentage(item.estimatedFlowRate || '0', flowrateData.totalFlowrate)
          }));
        
        return (
          <React.Fragment key={`totals-${addressIndex}`}>
            {/* Empty cell for points column */}
            <td className="px-4 py-4 text-sm text-right font-mono border-l whitespace-nowrap">
              &nbsp;
            </td>
            <td className="px-4 py-4 text-sm text-right whitespace-nowrap">
              <div className="flex items-center justify-end">
                {/* Show pie chart if we have data for visualization */}
                {pieChartData.length > 0 && (
                  <FlowratePieChart 
                    data={pieChartData}
                    pointSystemColors={pointSystemColors}
                    pointSystemNames={pointSystemNames}
                  />
                )}
                
                <div className="flex flex-col items-end">
                  {/* Total claimed flowrate */}
                  <div className="font-mono text-gray-900 font-bold relative group">
                    {convertFlowRate(flowrateData.totalClaimedFlowrate, timeUnit)}
                    <div className="absolute bottom-full mb-1 right-0 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                      SUP/{timeUnit}
                    </div>
                  </div>
                  
                  {/* Show unclaimed flowrate if any */}
                  {BigInt(flowrateData.totalUnclaimedFlowrate) > BigInt(0) && (
                    <div className="font-mono text-yellow-600 text-sm relative group">
                      +{convertFlowRate(flowrateData.totalUnclaimedFlowrate, timeUnit)}
                      <div className="absolute bottom-full mb-1 right-0 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-1 px-2 whitespace-nowrap">
                        SUP/{timeUnit}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </td>
          </React.Fragment>
        );
      })}
    </tr>
  );
};

export default TotalsRow; 