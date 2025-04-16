import React, { useState } from 'react';
import { referralApi } from '../../utils/api';
import ErrorMessage from '../ErrorMessage';
import LoadingSpinner from '../LoadingSpinner';

const ReferralTab: React.FC = () => {
  const [address, setAddress] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Input validation
    if (!address.trim()) {
      setError('Ethereum address is required');
      return;
    }
    
    if (!referralCode.trim()) {
      setError('Referral code is required');
      return;
    }
    
    // Call API to log referral
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      
      const response = await referralApi.logReferral({
        referralAddress: address.trim(),
        referrerCode: referralCode.trim()
      });
      
      if (response.success) {
        setSuccessMessage('Your referral has been successfully registered!');
        // Clear form
        setAddress('');
        setReferralCode('');
      } else {
        setError(response.message || 'Failed to register referral. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred while registering your referral');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Use a Referral Code</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Enter your address and a referral code to register as a referred user.
        </p>
      </div>
      
      <div className="px-4 py-5 sm:px-6">
        {error && <ErrorMessage message={error} />}
        
        {successMessage && (
          <div className="rounded-md bg-green-50 p-4 mb-4">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-green-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <p className="text-sm font-medium text-green-800">{successMessage}</p>
                <p className="mt-2 text-sm text-green-700">
                  Your SUP allocations will now contribute to both your and your referrer's rewards!
                </p>
              </div>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
              Your Ethereum Address
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="address"
                name="address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="0x..."
                disabled={loading}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              This address will be linked to the referrer.
            </p>
          </div>
          
          <div>
            <label htmlFor="referralCode" className="block text-sm font-medium text-gray-700">
              Referral Code
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="referralCode"
                name="referralCode"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="Enter referral code"
                disabled={loading}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              The unique code provided by your referrer.
            </p>
          </div>
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? <LoadingSpinner isLoading={true} size="sm" /> : 'Submit Referral'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ReferralTab; 