import React, { useState } from 'react';
import { AddressEligibility } from '../../types';
import UserProfileDisplay, { UserProfile } from '../../components/UserProfileDisplay';
import axios from 'axios';
import { TimeUnit, getAllPointSystems, POINT_SYSTEM_COLORS, calculateAddressFlowrates } from './utils';
import { ExpandedActivities } from './types';
import ProgramRow from './ProgramRow';
import TotalsRow from './TotalsRow';

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

const FlowrateBreakdown = ({ 
  dataList, 
  userProfiles, 
  onAddressCopy, 
  onRemoveUser,
  timeUnit: externalTimeUnit,
}: FlowrateBreakdownProps) => {
  // State
  const [expandedActivities, setExpandedActivities] = useState<ExpandedActivities>({});
  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  
  // Early return if no data
  if (!dataList.length) return null;
  
  // Derived data
  const allPointSystems = getAllPointSystems(dataList);
  const pointSystemIds = Object.keys(allPointSystems).map(Number);
  
  // Calculate flowrates only when dataList changes
  const addressFlowrates = dataList.map(data => calculateAddressFlowrates(data));
  
  // Simplified activity loading function
  const loadActivityData = async (address: string, pointSystemId: number, forceCollapse = false) => {
    const activityKey = `${pointSystemId}-${address}`;
    
    // Handle collapse case
    if ((expandedActivities[activityKey]?.data && !forceCollapse) || forceCollapse) {
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
        await loadActivityData(dataList[i].address, pointSystemId);
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

  // Use either external or internal time unit
  const timeUnit = externalTimeUnit !== undefined ? externalTimeUnit : 'month';

  // Now render the UI
  return (
    <div className="relative">
      <div className="flex justify-center items-center">
        <div className="overflow-x-auto w-fit">
          <table className="divide-y divide-gray-200 table-auto border-collapse mx-auto">
            <colgroup>
              <col className="min-w-[350px] w-auto" />{/* Program column */}
              {dataList.map((_, index) => (
                <React.Fragment key={`cols-${index}`}>
                  <col className="min-w-[200px] w-auto" />{/* Points column */}
                  <col className="min-w-[200px] w-auto" />{/* Flowrate column */}
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
                <ProgramRow
                  key={`program-row-${pointSystemId}`}
                  pointSystemId={pointSystemId}
                  pointSystemName={allPointSystems[pointSystemId]}
                  dataList={dataList}
                  expandedActivities={expandedActivities}
                  selectedRowId={selectedRowId}
                  handleRowClick={handleRowClick}
                  toggleProgramActivities={toggleProgramActivities}
                  timeUnit={timeUnit}
                />
              ))}
              
              {/* Totals row */}
              <TotalsRow
                dataList={dataList}
                addressFlowrates={addressFlowrates}
                pointSystemNames={allPointSystems}
                pointSystemColors={POINT_SYSTEM_COLORS}
                timeUnit={timeUnit}
              />
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default FlowrateBreakdown; 