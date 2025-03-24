import { useState, FormEvent } from 'react';

interface AddAddressFormProps {
  onSubmit: (address: string) => void;
  isLoading: boolean;
}

const AddAddressForm = ({ onSubmit, isLoading }: AddAddressFormProps) => {
  const [address, setAddress] = useState('');
  const [isValid, setIsValid] = useState(true);

  const validateAddress = (value: string) => {
    // Simple validation for Ethereum address format
    const isValidFormat = /^0x[a-fA-F0-9]{40}$/.test(value);
    setIsValid(isValidFormat);
    return isValidFormat;
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (validateAddress(address)) {
      onSubmit(address);
      setAddress('');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="mt-4 mb-4">
      <div className="justify-center w-[360px]">
        <label htmlFor="compare-address" className="block text-sm font-medium text-gray-700 mb-1">
          Add address to compare
        </label>
        <div className="inline-flex shadow-sm w-full max-w-[600px]">
          <input
            type="text"
            name="compare-address"
            id="compare-address"
            className={`flex-grow min-w-0 border-y border-l border-gray-300 pl-3 py-2 h-[38px] rounded-l-md text-sm focus:outline-none focus:border-superfluid-indigo ${
              !isValid ? 'border-red-300 text-red-900 placeholder-red-300 focus:border-red-500' : ''
            }`}
            style={{ borderWidth: '1px', boxSizing: 'border-box' }}
            placeholder="0x..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            disabled={isLoading}
          />
          <button
            type="submit"
            className={`border-y border-r border-gray-300 px-3 h-[38px] text-sm font-medium rounded-r-md text-white bg-superfluid-blue hover:bg-superfluid-blue/90 focus:outline-none ${
              isLoading ? 'opacity-75 cursor-not-allowed' : ''
            }`}
            style={{ borderWidth: '1px', boxSizing: 'border-box' }}
            disabled={isLoading || !address.trim() || !isValid}
          >
            {isLoading ? '...' : '+'}
          </button>
        </div>
        {!isValid && (
          <p className="mt-2 text-sm text-red-600">
            Please enter a valid Ethereum address
          </p>
        )}
      </div>
    </form>
  );
};

export default AddAddressForm;