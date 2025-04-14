import * as React from 'react'
const { useState, useEffect } = React
import PageHeader from './components/PageHeader'
import AddressManager from './components/AddressManager'

function App() {
  const [addresses, setAddresses] = useState<string[]>([])
  const [initialLoadComplete, setInitialLoadComplete] = useState(false)

  // Load addresses from URL on initial render
  useEffect(() => {
    const url = new URL(window.location.href);
    
    // Get addresses from the URL parameter
    const addressesParam = url.searchParams.get('addresses');
    const addressesFromUrl = addressesParam ? addressesParam.split(',') : [];
    
    setAddresses(addressesFromUrl);
    setInitialLoadComplete(true);
  }, []);

  // Update URL when addresses change
  useEffect(() => {
    if (!initialLoadComplete) return;

    const url = new URL(window.location.href);
    
    // Remove all query parameters
    url.search = '';
    
    // Add addresses as a single comma-separated parameter
    if (addresses.length > 0) {
      url.searchParams.set('addresses', addresses.join(','));
    }
    
    // Update URL without page reload
    window.history.pushState({}, '', url.toString());
  }, [addresses, initialLoadComplete]);

  // Handle address list changes from AddressManager
  const handleAddressesChange = (newAddresses: string[]) => {
    setAddresses(newAddresses);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6">
      <div className="w-full mx-auto">
        <PageHeader 
          title="Superfluid Flowrate Checker" 
          subtitle="Check and compare SUP allocations for multiple addresses" 
        />

        <AddressManager 
          initialAddresses={addresses}
          onAddressesChange={handleAddressesChange}
        />
      </div>
    </div>
  )
}

export default App 