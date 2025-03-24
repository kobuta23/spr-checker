import { useState, useEffect } from 'react'
import FlowrateBreakdown from './components/FlowrateBreakdown'
import { AddressEligibility } from './types'
import axios from 'axios'
import UserProfileDisplay, { UserProfile } from './components/UserProfileDisplay'
import AddAddressForm from './components/AddAddressForm'

function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addressDataList, setAddressDataList] = useState<AddressEligibility[]>([])
  const [addingAddress, setAddingAddress] = useState(false)
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)
  const [userProfiles, setUserProfiles] = useState<Record<string, UserProfile>>({})

  // Update URL when addresses change
  useEffect(() => {
    if (!initialLoadComplete) return;

    const addresses = addressDataList.map(data => data.address);
    const url = new URL(window.location.href);
    
    // Clear any existing 'address' parameters
    url.searchParams.delete('address');
    
    // Add each address as a separate 'address' parameter
    addresses.forEach(address => {
      url.searchParams.append('address', address);
    });
    
    // Update URL without page reload
    window.history.pushState({}, '', url.toString());
  }, [addressDataList, initialLoadComplete]);

  // Load addresses from URL on initial render
  useEffect(() => {
    const loadAddressesFromUrl = async () => {
      const url = new URL(window.location.href);
      const addressParams = url.searchParams.getAll('address');
      
      if (addressParams.length === 0) {
        setInitialLoadComplete(true);
        return;
      }
      
      setLoading(true);
      setError(null);
      
      try {
        // Fetch data for all addresses
        const response = await axios.get(`/eligibility?addresses=${addressParams.join(',')}`);
        
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
    
    loadAddressesFromUrl();
  }, []);

  // Function to fetch profile data from Superfluid Whois API
  const fetchUserProfile = async (address: string) => {
    try {
      const response = await axios.get(`https://whois.superfluid.finance/api/resolve/${address}`);
      const profiles = response.data;
      console.log(response.data);
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

  // Combine logic for handling addresses (whether first or additional)
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

  const removeAddress = (index: number) => {
    setAddressDataList(prev => prev.filter((_, i) => i !== index))
  }

  // Helper function to copy the current URL to clipboard
  const copyUrlToClipboard = () => {
    navigator.clipboard.writeText(window.location.href)
      .then(() => {
        // Could add a toast notification here
        console.log('URL copied to clipboard');
      })
      .catch(err => {
        console.error('Failed to copy URL: ', err);
      });
  }

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

  // Format address for display
  const formatAddress = (address: string): string => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6">
      <div className="w-full mx-auto">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Superfluid Flowrate Checker
          </h1>
          <p className="mt-3 text-xl text-gray-500">
            Check and compare SUP allocations for multiple addresses
          </p>
        </div>

        {/* Add Address Form */}
        <div className="flex justify-center">
          <AddAddressForm 
            onSubmit={handleAddressSubmit} 
            isLoading={loading || addingAddress} 
          />
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            {error && (
              <div className="mt-4 bg-red-50 border-l-4 border-red-400 p-4">
                <div className="flex">
                  <div className="flex-shrink-0">
                    <svg className="h-5 w-5 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </div>
                  <div className="ml-3">
                    <p className="text-sm text-red-700">{error}</p>
                  </div>
                </div>
              </div>
            )}
            
            {(loading || addingAddress) && (
              <div className="flex justify-center mt-6">
                <div className="loader">
                  <div className="w-12 h-12 border-4 border-superfluid-blue border-t-transparent rounded-full animate-spin"></div>
                </div>
              </div>
            )}
            
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
    </div>
  )
}

export default App 