import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import FlowrateBreakdown from './FlowrateBreakdown';
import AddAddressForm from './AddAddressForm';
import ErrorMessage from './ErrorMessage';
import LoadingSpinner from './LoadingSpinner';
import { AddressEligibility } from '../types';
import UserProfileDisplay, { UserProfile } from './UserProfileDisplay';
import Address from './Address';

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
  const [loadingAddresses, setLoadingAddresses] = useState<string[]>([]);
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});

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
      setLoadingAddresses(initialAddresses);
      
      try {
        const response = await axios.get(`/eligibility?addresses=${initialAddresses.join(',')}`);
        
        if (response.data.results && response.data.results.length > 0) {
          setAddressDataList(response.data.results);
          
          // Fetch profiles for all addresses
          fetchUserProfiles(response.data.results.map((result: AddressEligibility) => result.address));
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
        setLoadingAddresses([]);
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

  // Fetch user profiles from Superfluid API
  const fetchUserProfiles = async (addresses: string[]) => {
    try {
      // Create a map to store profiles
      const profiles: Record<string, UserProfile> = {};
      
      // Fetch profiles for each address
      for (const address of addresses) {
        try {
          const response = await axios.get(`/superfluid/resolve/${address}`);
          
          if (response.data) {
            // Extract profile information
            const { ensName, ensAvatar, fcData, lensData } = response.data;
            
            // Build profile object
            profiles[address] = {
              address,
              displayName: ensName || null,
              avatarUrl: ensAvatar || null,
              profiles: {
                ENS: ensName ? { handle: ensName, avatarUrl: ensAvatar } : undefined,
                Farcaster: fcData ? { handle: fcData.username, avatarUrl: fcData.pfp?.url || null } : undefined,
                Lens: lensData ? { handle: lensData.handle, avatarUrl: lensData.picture?.original?.url || null } : null
              }
            };
          }
        } catch (err) {
          console.error(`Failed to fetch profile for ${address}:`, err);
          // Continue with other addresses even if one fails
        }
      }
      
      // Update profiles state
      setUserProfiles(prevProfiles => ({
        ...prevProfiles,
        ...profiles
      }));
      
    } catch (err) {
      console.error('Error fetching user profiles:', err);
    }
  };

  // Handle address submission
  const handleAddressSubmit = async (address: string) => {
    // Check if address is already in the list
    if (addressDataList.some(data => data.address.toLowerCase() === address.toLowerCase())) {
      setError('This address is already in the comparison');
      return;
    }
    
    setAddingAddress(true);
    setError(null);
    setLoadingAddresses(prev => [...prev, address]);
    
    try {
      const response = await axios.get(`/eligibility?addresses=${address}`);
      
      if (response.data.results && response.data.results.length > 0) {
        setAddressDataList(prev => [...prev, response.data.results[0]]);
        
        // Fetch profile for the new address
        fetchUserProfiles([address]);
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
      setLoadingAddresses(prev => prev.filter(a => a !== address));
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

  // Render a skeleton UI for when addresses are loading
  const renderAddressSkeleton = () => {
    if (loadingAddresses.length === 0) return null;
    
    return (
      <div className="bg-white shadow rounded-lg overflow-hidden mt-6">
        <div className="px-4 py-5 sm:p-6">
          <h3 className="text-lg leading-6 font-medium text-gray-900 mb-4">Loading Addresses</h3>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Address
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {loadingAddresses.map((address, index) => (
                  <tr key={`loading-${index}-${address}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <UserProfileDisplay address={address} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <div className="flex items-center">
                        <div className="h-4 w-4 mr-2 rounded-full border-2 border-indigo-500 border-t-transparent animate-spin"></div>
                        Loading data...
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
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

      {error && <ErrorMessage message={error} />}
      
      {/* Show skeleton UI when addresses are loading */}
      {renderAddressSkeleton()}

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          {loading && <LoadingSpinner isLoading={true} />}
          
          {addressDataList.length > 0 && !loading && (
            <div className="mt-6">
              <FlowrateBreakdown 
                dataList={addressDataList} 
                userProfiles={userProfiles} // Pass the user profiles we fetched
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