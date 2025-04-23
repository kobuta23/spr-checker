import React, { useState } from 'react';
import { referralApi } from '../../utils/api';
import ErrorMessage from '../ErrorMessage';
import LoadingSpinner from '../LoadingSpinner';

const RegisterTab: React.FC = () => {
  const [address, setAddress] = useState('');
  const [discordUsername, setDiscordUsername] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [referralCodes, setReferralCodes] = useState<string[]>([]);
  const [level, setLevel] = useState<number | null>(null);
  const [maxReferrals, setMaxReferrals] = useState<number | null>(null);

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Input validation
    if (!address.trim()) {
      setError('Ethereum address is required');
      return;
    }
    
    if (!discordUsername.trim()) {
      setError('Discord username is required');
      return;
    }
    
    // Call API to register
    try {
      setLoading(true);
      setError(null);
      setSuccessMessage(null);
      setReferralCodes([]);
      setLevel(null);
      setMaxReferrals(null);
      
      const response = await referralApi.addReferrer({
        address: address.trim(),
        discordUsername: discordUsername.trim()
      });
      
      if (response.success && response.codes) {
        setSuccessMessage('You have been successfully registered as a referrer!');
        setReferralCodes(response.codes);
        setLevel(response.level || 1);
        setMaxReferrals(response.maxReferrals || 3);
        
        // Clear form
        setAddress('');
        setDiscordUsername('');
      } else {
        setError(response.message || 'Failed to register. Please try again.');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred during registration');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (code: string) => {
    navigator.clipboard.writeText(code);
    setSuccessMessage(`Code ${code} copied to clipboard!`);
    setTimeout(() => setSuccessMessage('You have been successfully registered as a referrer!'), 2000);
  };

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6">
        <h3 className="text-lg leading-6 font-medium text-gray-900">Register as a Referrer</h3>
        <p className="mt-1 max-w-2xl text-sm text-gray-500">
          Get your referral codes and start earning rewards when others use them.
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
                
                {level !== null && maxReferrals !== null && (
                  <p className="mt-2 text-sm text-green-700">
                    You are now a Level {level} referrer with a maximum of {maxReferrals} referrals.
                  </p>
                )}
                
                {referralCodes.length > 0 && (
                  <div className="mt-3">
                    <p className="text-sm text-green-700">Your referral codes are:</p>
                    
                    <div className="mt-2 grid grid-cols-1 gap-2">
                      {referralCodes.map((code, index) => (
                        <div key={index} className="flex items-center justify-between bg-green-100 px-3 py-2 rounded">
                          <span className="font-mono text-md font-medium">{code}</span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(code)}
                            className="ml-2 text-green-600 hover:text-green-800 focus:outline-none flex items-center"
                          >
                            <svg className="h-5 w-5 mr-1" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
                            </svg>
                            Copy
                          </button>
                        </div>
                      ))}
                    </div>
                    
                    <p className="mt-3 text-sm text-green-700">
                      Share these codes with others to earn rewards! Each code can only be used once.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="address" className="block text-sm font-medium text-gray-700">
              Ethereum Address
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
              This is the address that will receive the referral rewards.
            </p>
          </div>
          
          <div>
            <label htmlFor="discord" className="block text-sm font-medium text-gray-700">
              Discord Username
            </label>
            <div className="mt-1">
              <input
                type="text"
                id="discord"
                name="discord"
                value={discordUsername}
                onChange={(e) => setDiscordUsername(e.target.value)}
                className="shadow-sm focus:ring-indigo-500 focus:border-indigo-500 block w-full sm:text-sm border-gray-300 rounded-md"
                placeholder="username#1234"
                disabled={loading}
              />
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Your Discord username will be displayed on the leaderboard.
            </p>
          </div>
          
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full inline-flex justify-center items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {loading ? <LoadingSpinner isLoading={true} size="sm" /> : 'Register'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterTab; 