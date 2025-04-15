import React from 'react'
import PageHeader from './components/PageHeader'
import AddressManager from './components/AddressManager'
import { useSearchParams } from 'react-router-dom'

function App() {
  const [searchParams, setSearchParams] = useSearchParams();
  
  // Get initial addresses from URL if available
  const getInitialAddresses = () => {
    const addressParam = searchParams.get('addresses');
    return addressParam ? addressParam.split(',') : [];
  };

  // Handle address list changes from AddressManager
  const handleAddressesChange = (newAddresses: string[]) => {
    // Update URL params when addresses change
    if (newAddresses.length > 0) {
      searchParams.set('addresses', newAddresses.join(','));
    } else {
      searchParams.delete('addresses');
    }
    setSearchParams(searchParams);
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4 sm:px-6">
      <div className="w-full mx-auto">
        <PageHeader 
          title="Superfluid Flowrate Checker" 
          subtitle="Check and compare SUP allocations for multiple addresses" 
        />

        <AddressManager 
          initialAddresses={getInitialAddresses()}
          onAddressesChange={handleAddressesChange}
        />
      </div>
    </div>
  )
}

export default App 