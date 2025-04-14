import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FlowrateBreakdown from './FlowrateBreakdown';
import AddAddressForm from './AddAddressForm';
import ErrorMessage from './ErrorMessage';
import LoadingSpinner from './LoadingSpinner';
import { AddressEligibility } from '../types';
import { UserProfile } from './UserProfileDisplay';

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
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Load initial addresses
  useEffect(() => {
    const loadAddresses = async () => {
      if (initialAddresses.length === 0) {
        setInitialLoadComplete(true);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // Fetch data for all addresses
        const response = await axios.get(`/eligibility?addresses=${initialAddresses.join(',')}`);
        
        if (response.data.results && response.data.results.length > 0) {
          setAddressDataList(response.data.results);
          
          // Fetch profiles for all addresses
          for (const result of response.data.results) {
            fetchUserProfile(result.address);
          }
        } else {
          setError('No data found for the provided addresses');
        }
      } catch (err) {
        // Error handling
        if (axios.isAxiosError(err) && err.response) {
          setError(err.response.data.message || 'Failed to fetch data for the provided addresses');
        } else {
          setError('An unexpected error occurred');
        }
      } finally {
        setLoading(false);
        setInitialLoadComplete(true);
      }
    };
    
    loadAddresses();
  }, [initialAddresses]);

  // Notify parent when addresses change
  useEffect(() => {
    if (!initialLoadComplete) return;
    
    const addresses = addressDataList.map(data => data.address);
    if (onAddressesChange) {
      onAddressesChange(addresses);
    }
  }, [addressDataList, initialLoadComplete, onAddressesChange]);

  // Function to fetch profile data from Superfluid Whois API
  const fetchUserProfile = async (address: string) => {
    try {
      const response = await axios.get(`/superfluid/resolve/${address}`);
      const profiles = response.data;
      // Find the first available profile name to use as display name
      let displayName = null;
      let avatarUrl = null;
      
      if (profiles.ENS?.handle) {
        displayName = profiles.ENS.handle;
        avatarUrl = profiles.ENS.avatarUrl;
      } else if (profiles.Farcaster?.handle) {
        displayName = profiles.Farcaster.handle;
        avatarUrl = profiles.Farcaster.avatarUrl;
      } else if (profiles.Lens?.handle) {
        displayName = profiles.Lens.handle.replace('lens/', '');
        avatarUrl = profiles.Lens.avatarUrl;
      } else if (profiles.AlfaFrens?.handle) {
        displayName = profiles.AlfaFrens.handle;
        avatarUrl = profiles.AlfaFrens.avatarUrl;
      }
        
      setUserProfiles(prev => ({
        ...prev,
        [address]: {
          address,
          displayName,
          avatarUrl,
          profiles
        }
      }));
    } catch (err) {
      console.error('Failed to fetch profile for address:', address, err);
      // Still add the address to profiles but without additional data
      setUserProfiles(prev => ({
        ...prev,
        [address]: {
          address,
          displayName: null,
          avatarUrl: null,
          profiles: {}
        }
      }));
    }
  };

  // Handle address submission
  const handleAddressSubmit = async (address: string) => {
    const isFirstAddress = addressDataList.length === 0;
    
    if (isFirstAddress) {
      setLoading(true);
    } else {
      setAddingAddress(true);
    }
    
    setError(null);
    
    try {
      // Check if address is already in the list
      if (addressDataList.some(data => data.address.toLowerCase() === address.toLowerCase())) {
        setError('This address is already in the comparison');
        setAddingAddress(false);
        setLoading(false);
        return;
      }
      
      const response = await axios.get(`/eligibility?addresses=${address}`);
      
      if (response.data.results && response.data.results.length > 0) {
        if (isFirstAddress) {
          setAddressDataList([response.data.results[0]]);
        } else {
          setAddressDataList(prev => [...prev, response.data.results[0]]);
        }
        
        // Fetch profile for the address
        fetchUserProfile(address);
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
      setLoading(false);
      setAddingAddress(false);
    }
  };

  // Remove address from list
  const removeAddress = (index: number) => {
    setAddressDataList(prev => prev.filter((_, i) => i !== index));
  };

  // Helper function to copy address to clipboard
  const copyAddressToClipboard = (address: string) => {
    navigator.clipboard.writeText(address)
      .then(() => {
        console.log('Address copied to clipboard');
      })
      .catch(err => {
        console.error('Failed to copy address: ', err);
      });
  };

  return (
    <div>
      {/* Add Address Form */}
      <div className="flex justify-center">
        <AddAddressForm 
          onSubmit={handleAddressSubmit} 
          isLoading={loading || addingAddress} 
        />
      </div>

      <div className="bg-white shadow rounded-lg overflow-hidden">
        <div className="px-4 py-5 sm:p-6">
          <ErrorMessage message={error || ''} />
          
          <LoadingSpinner isLoading={loading || addingAddress} />
          
          {addressDataList.length > 0 && !loading && !addingAddress && (
            <div className="mt-6">
              <FlowrateBreakdown 
                dataList={addressDataList} 
                userProfiles={userProfiles}
                onAddressCopy={copyAddressToClipboard}
                onRemoveUser={(address) => {
                  const index = addressDataList.findIndex(data => data.address === address);
                  if (index !== -1) {
                    removeAddress(index);
                  }
                }}
                onAddAddress={handleAddressSubmit}
                isLoading={loading || addingAddress}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddressManager; 