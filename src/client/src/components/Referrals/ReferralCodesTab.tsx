import React, { useState, useEffect } from 'react';
import { referralApi } from '../../utils/api';
import ErrorMessage from '../ErrorMessage';
import LoadingSpinner from '../LoadingSpinner';

interface ReferralCodesTabProps {
  address?: string;
}

const ReferralCodesTab: React.FC<ReferralCodesTabProps> = ({ address }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unusedCodes, setUnusedCodes] = useState<string[]>([]);
  const [success, setSuccess] = useState<string | null>(null);
  const [userAddress, setUserAddress] = useState<string>('');

  useEffect(() => {
    if (address) {
      setUserAddress(address);
      fetchCodes(address);
    }
  }, [address]);

  const fetchCodes = async (addressToFetch: string) => {
    if (!addressToFetch) return;
    
    try {
      setIsLoading(true);
      setError(null);
      
      const response = await referralApi.getCodes(addressToFetch);
      
      if (response.success && response.data) {
        setUnusedCodes(response.data.unusedCodes || []);
      } else {
        setError('Failed to load referral codes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred loading codes');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (userAddress) {
      fetchCodes(userAddress);
    }
  };

  const handleGenerateCodes = async () => {
    if (!userAddress) return;
    
    try {
      setIsGenerating(true);
      setError(null);
      setSuccess(null);
      
      const response = await referralApi.generateCodes(userAddress);
      
      if (response.success) {
        // Refresh codes
        fetchCodes(userAddress);
        setSuccess(`Successfully generated ${response.codes.length} new code(s).`);
      } else {
        setError('Failed to generate new codes');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred generating codes');
    } finally {
      setIsGenerating(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code)
      .then(() => {
        setSuccess(`Copied code ${code} to clipboard!`);
        setTimeout(() => setSuccess(null), 3000);
      })
      .catch(() => {
        setError('Failed to copy code to clipboard');
      });
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Referral Codes</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          View your available one-time use referral codes and generate new ones.
        </p>
      </div>
      
      <div className="border-t border-gray-200 px-4 py-5 sm:px-6">
        <form onSubmit={handleAddressSubmit} className="mb-6">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="flex-grow">
              <label htmlFor="address" className="block text-sm font-medium text-gray-700 mb-1">Ethereum Address</label>
              <input
                type="text"
                id="address"
                value={userAddress}
                onChange={(e) => setUserAddress(e.target.value)}
                placeholder="0x..."
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
              />
            </div>
            <div className="flex items-end">
              <button
                type="submit"
                disabled={isLoading || !userAddress}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isLoading ? 'Loading...' : 'Load Codes'}
              </button>
            </div>
          </div>
        </form>
        
        {error && <ErrorMessage message={error} />}
        
        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-md">
            {success}
          </div>
        )}
        
        {isLoading ? (
          <div className="flex justify-center py-8">
            <LoadingSpinner isLoading={true} />
          </div>
        ) : (
          <>
            <div className="mb-4">
              <h4 className="text-base font-medium text-gray-800 mb-2">Your Unused Referral Codes</h4>
              
              {unusedCodes.length === 0 ? (
                <p className="text-gray-500">No available codes found. Generate new ones below.</p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {unusedCodes.map((code, idx) => (
                    <div 
                      key={idx} 
                      className="bg-gray-50 p-3 rounded-md border border-gray-200 flex justify-between items-center"
                    >
                      <span className="font-mono font-medium">{code}</span>
                      <button
                        onClick={() => copyToClipboard(code)}
                        className="text-xs text-indigo-600 hover:text-indigo-800"
                      >
                        Copy
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            
            <div className="mt-6">
              <button
                onClick={handleGenerateCodes}
                disabled={isGenerating || !userAddress}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
              >
                {isGenerating ? 'Generating...' : 'Generate New Codes'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ReferralCodesTab; 