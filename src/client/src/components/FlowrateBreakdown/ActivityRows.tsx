import React from 'react';
import { AddressEligibility } from '../../types';
import { ExpandedActivities } from './types';
import { convertFlowRate, findEligibilityItem, calculateActivityFlowrate } from './utils';
import { TimeUnit } from './utils';

interface ActivityRowsProps {
  pointSystemId: number;
  dataList: AddressEligibility[];
  expandedActivities: ExpandedActivities;
  selectedRowId: string | null;
  handleRowClick: (rowId: string) => void;
  timeUnit: TimeUnit;
}

const ActivityRows: React.FC<ActivityRowsProps> = ({
  pointSystemId,
  dataList,
  expandedActivities,
  selectedRowId,
  handleRowClick,
  timeUnit
}) => {
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
  const loadingStates = dataList.map((data) => {
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
  const errorStates = dataList.map((data) => {
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
    return <>{[...loadingStates, ...errorStates]}</>;
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
  return (
    <>
      {Array.from(uniqueActivities.values()).map((activityData, activityIndex) => {
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
      })}
    </>
  );
};

export default ActivityRows; 