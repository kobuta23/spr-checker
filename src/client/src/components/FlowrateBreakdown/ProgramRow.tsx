import React from 'react';
import { AddressEligibility } from '../../types';
import { findEligibilityItem, getPointSystemColor, getUnclaimedPoints, convertFlowRate } from './utils';
import { TimeUnit } from './utils';
import ActivityRows from './ActivityRows';
import { ExpandedActivities } from './types';

interface ProgramRowProps {
  pointSystemId: number;
  pointSystemName: string;
  dataList: AddressEligibility[];
  expandedActivities: ExpandedActivities;
  selectedRowId: string | null;
  handleRowClick: (rowId: string) => void;
  toggleProgramActivities: (pointSystemId: number) => Promise<void>;
  timeUnit: TimeUnit;
}

const ProgramRow: React.FC<ProgramRowProps> = ({
  pointSystemId,
  pointSystemName,
  dataList,
  expandedActivities,
  selectedRowId,
  handleRowClick,
  toggleProgramActivities,
  timeUnit
}) => {
  const isExpanded = dataList.some(data => !!expandedActivities[`${pointSystemId}-${data.address}`]);
  
  return (
    <React.Fragment key={`system-fragment-${pointSystemId}`}>
      <tr 
        key={`system-${pointSystemId}`} 
        className={`${isExpanded ? 'bg-blue-50 border-l-4 border-l-blue-300' : ''} ${
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
              <span className="truncate max-w-[200px] inline-block">{pointSystemName}</span>
            </div>
            
            {/* Add expand/collapse button */}
            <button
              onClick={(e) => {
                e.stopPropagation(); // Prevent row click when clicking the button
                toggleProgramActivities(pointSystemId);
              }}
              className={`ml-2 p-1.5 rounded-full focus:outline-none flex-shrink-0 ${
                isExpanded 
                  ? 'text-blue-500 hover:text-blue-700 bg-blue-50 hover:bg-blue-100' 
                  : 'text-green-500 hover:text-green-700 bg-green-50 hover:bg-green-100'
              }`}
              title={isExpanded ? "Collapse activities" : "Expand activities"}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                {isExpanded ? (
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
      {isExpanded && (
        <ActivityRows
          pointSystemId={pointSystemId}
          dataList={dataList}
          expandedActivities={expandedActivities}
          selectedRowId={selectedRowId}
          handleRowClick={handleRowClick}
          timeUnit={timeUnit}
        />
      )}
    </React.Fragment>
  );
};

export default ProgramRow; 