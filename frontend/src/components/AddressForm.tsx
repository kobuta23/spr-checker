import { useState, FormEvent } from 'react'

interface AddressFormProps {
  onSubmit: (address: string) => void
  isLoading: boolean
}

const AddressForm = ({ onSubmit, isLoading }: AddressFormProps) => {
  const [address, setAddress] = useState('')
  const [isValid, setIsValid] = useState(true)

  const validateAddress = (value: string) => {
    // Simple validation for Ethereum address format
    const isValidFormat = /^0x[a-fA-F0-9]{40}$/.test(value)
    setIsValid(isValidFormat)
    return isValidFormat
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (validateAddress(address)) {
      onSubmit(address)
    }
  }

  return (
    <form onSubmit={handleSubmit}>
      <div className="mb-4">
        <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">
          Ethereum Address
        </label>
        <div className="mt-1 flex rounded-md shadow-sm">
          <input
            type="text"
            name="address"
            id="address"
            className={`focus:ring-superfluid-indigo focus:border-superfluid-indigo flex-1 block w-full rounded-md sm:text-sm border-gray-300 ${!isValid ? 'border-red-300 text-red-900 placeholder-red-300 focus:ring-red-500 focus:border-red-500' : ''}`}
            placeholder="0x..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={isLoading}
          />
        </div>
        {!isValid && (
          <p className="mt-2 text-sm text-red-600">
            Please enter a valid Ethereum address (0x followed by 40 hexadecimal characters)
          </p>
        )}
      </div>
      <div className="flex justify-end">
        <button
          type="submit"
          className={`inline-flex justify-center py-2 px-4 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-superfluid-blue hover:bg-superfluid-indigo focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-superfluid-indigo ${isLoading ? 'opacity-75 cursor-not-allowed' : ''}`}
          disabled={isLoading || !address.trim() || !isValid}
        >
          {isLoading ? 'Checking...' : 'Check Flowrate'}
        </button>
      </div>
    </form>
  )
}

export default AddressForm 