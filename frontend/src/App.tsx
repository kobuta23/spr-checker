import { useState } from 'react'
import AddressForm from './components/AddressForm'
import FlowrateBreakdown from './components/FlowrateBreakdown'
import { AddressEligibility } from './types'
import axios from 'axios'

function App() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [addressData, setAddressData] = useState<AddressEligibility | null>(null)

  const checkAddress = async (address: string) => {
    setLoading(true)
    setError(null)
    
    try {
      const response = await axios.get(`/eligibility?addresses=${address}`)
      if (response.data.results && response.data.results.length > 0) {
        setAddressData(response.data.results[0])
      } else {
        setError('No data found for this address')
      }
    } catch (err) {
      if (axios.isAxiosError(err) && err.response) {
        setError(err.response.data.message || 'Failed to fetch data')
      } else {
        setError('An unexpected error occurred')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Superfluid Flowrate Checker
          </h1>
          <p className="mt-3 text-xl text-gray-500">
            Check the flowrate breakdown for any address
          </p>
        </div>

        <div className="bg-white shadow rounded-lg overflow-hidden">
          <div className="px-4 py-5 sm:p-6">
            <AddressForm onSubmit={checkAddress} isLoading={loading} />
            
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
            
            {loading && (
              <div className="flex justify-center mt-6">
                <div className="loader">
                  <div className="w-12 h-12 border-4 border-superfluid-blue border-t-transparent rounded-full animate-spin"></div>
                </div>
              </div>
            )}
            
            {addressData && !loading && (
              <div className="mt-6">
                <FlowrateBreakdown data={addressData} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

export default App 