import React, { useState } from 'react';
import PageHeader from '../PageHeader';
import LeaderboardTab from './LeaderboardTab';
import RegisterTab from './RegisterTab';
import ReferralTab from './ReferralTab';

// Tab types
type TabType = 'leaderboard' | 'register' | 'refer';

const ReferralsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabType>('leaderboard');

  // Function to render the active tab content
  const renderTabContent = () => {
    switch (activeTab) {
      case 'leaderboard':
        return <LeaderboardTab />;
      case 'register':
        return <RegisterTab />;
      case 'refer':
        return <ReferralTab />;
      default:
        return <LeaderboardTab />;
    }
  };

  return (
    <div>
      <PageHeader
        title="Superfluid Referral Program"
        subtitle="Refer friends to earn more SUP allocations"
      />

      {/* Tab navigation */}
      <div className="flex justify-center mb-8 border-b border-gray-200">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'leaderboard'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('leaderboard')}
          >
            Leaderboard
          </button>
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'register'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('register')}
          >
            Register as Referrer
          </button>
          <button
            className={`py-4 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'refer'
                ? 'border-indigo-500 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
            onClick={() => setActiveTab('refer')}
          >
            Use a Referral Code
          </button>
        </nav>
      </div>

      {/* Tab content */}
      <div className="max-w-5xl mx-auto">
        {renderTabContent()}
      </div>
    </div>
  );
};

export default ReferralsPage; 