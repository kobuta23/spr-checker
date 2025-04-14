import React, { useState, useEffect } from 'react';
import axios from 'axios';
import FlowrateBreakdown from './FlowrateBreakdown';
import AddAddressForm from './AddAddressForm';
import ErrorMessage from './ErrorMessage';
import LoadingSpinner from './LoadingSpinner';
import { AddressEligibility } from '../types';

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
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);

  // Load initial addresses - ONE TIME ONLY
  useEffect(() => {
    // Skip if we've already done the initial load
    if (initialLoadComplete) return;

    const loadAddresses = async () => {
      if (initialAddresses.length === 0) {
        setInitialLoadComplete(true);
        return;
      }
      
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
        setInitialLoadComplete(true);
      }
    };
    
    loadAddresses();
  }, []); // Empty dependency array - run ONCE only

  // Completely isolated second effect for address changes
  useEffect(() => {
    if (!initialLoadComplete) return;
    
    const addresses = addressDataList.map(data => data.address);
    if (onAddressesChange) {
      onAddressesChange(addresses);
    }
  }, [addressDataList, initialLoadComplete]);

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
      <div className="flex justify-center">
        <AddAddressForm 
          onSubmit={handleAddressSubmit} 
          isLoading={addingAddress} 
        />
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
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AddressManager; 