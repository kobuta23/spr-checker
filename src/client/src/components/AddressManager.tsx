import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import FlowrateBreakdown from './FlowrateBreakdown';
import AddAddressForm from './AddAddressForm';
import ErrorMessage from './ErrorMessage';
import LoadingSpinner from './LoadingSpinner';
import { AddressEligibility } from '../types';

// Define TimeUnit type for consistency
type TimeUnit = 'day' | 'month';

interface AddressManagerProps {
  initialAddresses?: string[];
  onAddressesChange?: (addresses: string[]) => void;
}

const AddressManager: React.FC<AddressManagerProps> = ({ 
  initialAddresses = [], 
  onAddressesChange 
}) => {
  const [addressDataList, setAddressDataList] = useState<AddressEligibility[]>([]);
  const [addingAddress, setAddingAddress] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const prevAddressesRef = useRef<string[]>([]);
  const [timeUnit, setTimeUnit] = useState<TimeUnit>('month'); // Add time unit state

  // Load initial addresses - ONE TIME ONLY
  useEffect(() => {
    // Only fetch data if initialAddresses has actually changed
    const initialAddressesStr = initialAddresses.join(',');
    const prevAddressesStr = prevAddressesRef.current.join(',');
    
    if (initialAddressesStr === prevAddressesStr || initialAddresses.length === 0) {
      return;
    }
    
    prevAddressesRef.current = [...initialAddresses];
    
    const loadAddresses = async () => {
      setLoading(true);
      setError(null);
      
      try {
        const response = await axios.get(`/eligibility?addresses=${initialAddresses.join(',')}`);
        
        if (response.data.results && response.data.results.length > 0) {
          setAddressDataList(response.data.results);
        } else {
          setError('No data found for the provided addresses');
        }
      } catch (err) {
        if (axios.isAxiosError(err) && err.response) {
          setError(err.response.data.message || 'Failed to fetch data');
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setLoading(false);
      }
    };
    
    loadAddresses();
  }, [initialAddresses]); // Only reload when initialAddresses changes

  // Update parent with address changes - but only when addressDataList changes, not on every render
  useEffect(() => {
    if (!onAddressesChange) return;
    
    const addresses = addressDataList.map(data => data.address);
    
    // Compare with previous addresses to avoid unnecessary updates
    const prevAddresses = prevAddressesRef.current;
    const addressesChanged = 
      addresses.length !== prevAddresses.length || 
      addresses.some((addr, i) => addr.toLowerCase() !== prevAddresses[i]?.toLowerCase());
    
    // Only update if addresses have actually changed
    if (addresses.length > 0 && addressesChanged) {
      // Update our ref with the new addresses
      prevAddressesRef.current = [...addresses];
      // Notify parent
      onAddressesChange(addresses);
    }
  }, [addressDataList, onAddressesChange]); // Adding onAddressesChange back is fine as we're properly guarding against excessive updates

  // Handle address submission
  const handleAddressSubmit = async (address: string) => {
    // Check if address is already in the list
    if (addressDataList.some(data => data.address.toLowerCase() === address.toLowerCase())) {
      setError('This address is already in the comparison');
      return;
    }
    
    setAddingAddress(true);
    setError(null);
    
    try {
      const response = await axios.get(`/eligibility?addresses=${address}`);
      
      if (response.data.results && response.data.results.length > 0) {
        setAddressDataList(prev => [...prev, response.data.results[0]]);
      } else {
        setError('No data found for this address');
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.message || 'Failed to fetch data');
      } else {
        setError('An unexpected error occurred');
      }
    } finally {
      setAddingAddress(false);
    }
  };

  // Remove address from list
  const removeAddress = (address: string) => {
    setAddressDataList(prev => prev.filter(data => data.address !== address));
  };

  // Helper function to copy address to clipboard
  const copyAddressToClipboard = (address: string) => {
    navigator.clipboard.writeText(address)
      .then(() => console.log('Address copied to clipboard'))
      .catch(err => console.error('Failed to copy address: ', err));
  };

  return (
    <div>
      <div className="flex items-center mb-4">
        {/* Spacer div to push content to center */}
        <div className="flex-1 min-w-[100px]"></div>
        
        {/* Centered address form */}
        <div className="flex-grow max-w-md">
          <AddAddressForm 
            onSubmit={handleAddressSubmit} 
            isLoading={addingAddress} 
          />
        </div>
        
        {/* Time unit toggle and spacer to balance layout */}
        <div className="flex-1 min-w-[100px] flex justify-end">
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
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          {error && <ErrorMessage message={error} />}
          
          {loading && <LoadingSpinner isLoading={true} />}
          
          {addressDataList.length > 0 && !loading && (
            <div className="mt-6">
              <FlowrateBreakdown 
                dataList={addressDataList} 
                userProfiles={{}} // Pass empty object instead of userProfiles
                onAddressCopy={copyAddressToClipboard}
                onRemoveUser={removeAddress}
                onAddAddress={handleAddressSubmit}
                isLoading={addingAddress}
                timeUnit={timeUnit} // Pass time unit to component
                onTimeUnitChange={setTimeUnit} // Pass setter to component
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddressManager; 