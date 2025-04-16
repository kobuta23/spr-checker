import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { referralApi } from '../../utils/api';
import { LeaderboardReferrer } from '../../types/referralTypes';
import ErrorMessage from '../ErrorMessage';
import LoadingSpinner from '../LoadingSpinner';

// Define rank emojis
const RANK_EMOJIS = {
  1: '⭐', // Rank 1: Star
  2: '🥉', // Rank 2: Bronze
  3: '🥈', // Rank 3: Silver
  4: '🥇'  // Rank 4: Gold
};

const LeaderboardTab: React.FC = () => {
  const navigate = useNavigate();
  const [leaderboardData, setLeaderboardData] = useState<LeaderboardReferrer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedReferrer, setExpandedReferrer] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [updating, setUpdating] = useState(false);
  const [updateMessage, setUpdateMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const [selectedAddresses, setSelectedAddresses] = useState<string[]>([]);
  
  // Load leaderboard data
  useEffect(() => {
    const fetchLeaderboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await referralApi.getLeaderboard();
        if (response.success && response.data) {
          setLeaderboardData(response.data);
        } else {
          setError('Failed to load leaderboard data');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred loading the leaderboard');
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboardData();
  }, []);

  // Format SUP income value for display
  const formatSUPIncome = (value: string) => {
    try {
      const bigIntValue = BigInt(value);
      // Dividing by 10^18 to convert wei to SUP
      const supValue = Number(bigIntValue) / (10 ** 18);
      return supValue.toFixed(4);
    } catch (e) {
      return '0.0000';
    }
  };

  // Get rank emoji based on rank number
  const getRankEmoji = (rank: number) => {
    return RANK_EMOJIS[rank as keyof typeof RANK_EMOJIS] || '⭐';
  };

  // Handle referrer click to expand/collapse
  const toggleReferrerExpand = (address: string) => {
    setExpandedReferrer(currentExpanded => 
      currentExpanded === address ? null : address
    );
  };

  // Toggle admin panel
  const toggleAdmin = () => {
    setIsAdmin(!isAdmin);
  };

  // Handle address selection for comparison
  const handleAddressSelection = (address: string) => {
    setSelectedAddresses(prev => {
      if (prev.includes(address)) {
        // Remove if already selected
        return prev.filter(a => a !== address);
      } else {
        // Add if not selected (limit to 5 addresses)
        return prev.length < 5 ? [...prev, address] : prev;
      }
    });
  };

  // Navigate to comparison page with selected addresses
  const handleCompare = () => {
    if (selectedAddresses.length > 0) {
      navigate(`/?addresses=${selectedAddresses.join(',')}`);
    }
  };
  
  // Handle updating SUP income
  const handleUpdateSUPIncome = async () => {
    try {
      setUpdating(true);
      setUpdateMessage(null);
      
      const response = await referralApi.updateSUPIncome();
      
      if (response.success) {
        setUpdateMessage({ 
          text: response.message || 'SUP income updated successfully!', 
          type: 'success' 
        });
        
        // Reload the leaderboard data to show updated values
        const leaderboardResponse = await referralApi.getLeaderboard();
        if (leaderboardResponse.success && leaderboardResponse.data) {
          setLeaderboardData(leaderboardResponse.data);
        }
      } else {
        setUpdateMessage({ 
          text: response.message || 'Failed to update SUP income', 
          type: 'error' 
        });
      }
    } catch (err) {
      setUpdateMessage({ 
        text: err instanceof Error ? err.message : 'An error occurred updating SUP income', 
        type: 'error' 
      });
    } finally {
      setUpdating(false);
    }
  };

  // Handle updating Discord leaderboard
  const handleUpdateDiscord = async () => {
    try {
      setUpdating(true);
      setUpdateMessage(null);
      
      const response = await referralApi.updateDiscord();
      
      if (response.success) {
        setUpdateMessage({ 
          text: response.message || 'Discord leaderboard updated successfully!', 
          type: 'success' 
        });
      } else {
        setUpdateMessage({ 
          text: response.message || 'Failed to update Discord leaderboard', 
          type: 'error' 
        });
      }
    } catch (err) {
      setUpdateMessage({ 
        text: err instanceof Error ? err.message : 'An error occurred updating Discord leaderboard', 
        type: 'error' 
      });
    } finally {
      setUpdating(false);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-12"><LoadingSpinner isLoading={true} /></div>;
  }

  if (error) {
    return <ErrorMessage message={error} />;
  }

  return (
    <div className="bg-white shadow overflow-hidden sm:rounded-lg">
      <div className="px-4 py-5 sm:px-6 flex justify-between items-center">
        <div>
          <h3 className="text-lg leading-6 font-medium text-gray-900">Referral Leaderboard</h3>
          <p className="mt-1 max-w-2xl text-sm text-gray-500">Top referrers ranked by total SUP income generated by their referrals.</p>
        </div>
        <div className="flex space-x-2 items-center">
          {selectedAddresses.length > 0 && (
            <button
              onClick={handleCompare}
              className="inline-flex items-center px-3 py-2 border border-transparent text-sm leading-4 font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Compare ({selectedAddresses.length})
            </button>
          )}
          <button
            onClick={toggleAdmin}
            className="inline-flex items-center px-3 py-2 border border-gray-300 shadow-sm text-sm leading-4 font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
          >
            {isAdmin ? 'Hide Admin' : 'Admin'}
          </button>
        </div>
      </div>

      {/* Admin section */}
      {isAdmin && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
          <h4 className="text-md font-medium text-gray-700 mb-2">Admin Controls</h4>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={handleUpdateSUPIncome}
              disabled={updating}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {updating ? 'Updating...' : 'Update SUP Income'}
            </button>
            <button
              onClick={handleUpdateDiscord}
              disabled={updating}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
            >
              {updating ? 'Updating...' : 'Update Discord Leaderboard'}
            </button>
          </div>
          {updateMessage && (
            <div className={`mt-2 text-sm ${updateMessage.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
              {updateMessage.text}
            </div>
          )}
        </div>
      )}
      
      {selectedAddresses.length > 0 && (
        <div className="px-4 py-3 bg-indigo-50 border-t border-indigo-200">
          <div className="flex justify-between items-center">
            <div className="text-sm text-indigo-700">
              <span className="font-medium">{selectedAddresses.length}</span> addresses selected for comparison
            </div>
            <button
              onClick={() => setSelectedAddresses([])}
              className="text-xs text-indigo-600 hover:text-indigo-900"
            >
              Clear selection
            </button>
          </div>
        </div>
      )}
      
      {leaderboardData.length === 0 ? (
        <div className="text-center py-10 text-gray-500">
          No referrers found. Be the first to register!
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th scope="col" className="px-2 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Select
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Rank
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Username
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Referrals
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total SUP Generated
                </th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Avg. SUP per Referral
                </th>
                <th scope="col" className="relative px-6 py-3">
                  <span className="sr-only">Details</span>
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {leaderboardData.map((referrer, index) => (
                <React.Fragment key={referrer.address}>
                  <tr className={`${expandedReferrer === referrer.address ? 'bg-gray-50' : 'hover:bg-gray-50'} ${selectedAddresses.includes(referrer.address) ? 'bg-indigo-50' : ''}`}>
                    <td className="px-2 py-4 whitespace-nowrap text-sm font-medium">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                        checked={selectedAddresses.includes(referrer.address)}
                        onChange={() => handleAddressSelection(referrer.address)}
                        disabled={selectedAddresses.length >= 5 && !selectedAddresses.includes(referrer.address)}
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      <span className="flex items-center">
                        <span className="mr-2">{getRankEmoji(referrer.rank)}</span>
                        {index + 1}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {referrer.username}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      <span className={referrer.referralCount >= referrer.maxReferrals ? "text-red-500 font-semibold" : ""}>
                        {referrer.referralCount}/{referrer.maxReferrals}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatSUPIncome(referrer.totalReferralSUPincome)} SUP
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {formatSUPIncome(referrer.avgReferralSUPincome)} SUP
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <button
                        onClick={() => toggleReferrerExpand(referrer.address)}
                        className="text-indigo-600 hover:text-indigo-900"
                      >
                        {expandedReferrer === referrer.address ? 'Hide Details' : 'Show Details'}
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded details row */}
                  {expandedReferrer === referrer.address && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-4">
                        <div className="text-sm">
                          <p className="font-medium text-gray-800 mb-2">Referral Details</p>
                          
                          {referrer.referrals.length === 0 ? (
                            <p className="text-gray-500">No referrals yet</p>
                          ) : (
                            <div className="bg-white rounded border border-gray-200 overflow-hidden">
                              <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                  <tr>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Address
                                    </th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      SUP Income
                                    </th>
                                    <th scope="col" className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                      Actions
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {referrer.referrals.map(referral => (
                                    <tr key={referral.address}>
                                      <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500 font-mono">
                                        {referral.address.slice(0, 8)}...{referral.address.slice(-6)}
                                      </td>
                                      <td className="px-4 py-2 whitespace-nowrap text-xs text-gray-500">
                                        {formatSUPIncome(referral.SUPincome)} SUP
                                      </td>
                                      <td className="px-4 py-2 whitespace-nowrap text-xs">
                                        <button
                                          className="text-xs text-indigo-600 hover:text-indigo-900"
                                          onClick={() => handleAddressSelection(referral.address)}
                                          disabled={selectedAddresses.length >= 5 && !selectedAddresses.includes(referral.address)}
                                        >
                                          {selectedAddresses.includes(referral.address) ? 'Unselect' : 'Select for Comparison'}
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default LeaderboardTab; 