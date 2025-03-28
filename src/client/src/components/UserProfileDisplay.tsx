import React, { useState } from 'react';

export interface UserProfile {
  address: string;
  displayName: string | null;
  avatarUrl: string | null;
  profiles: {
    AlfaFrens?: { handle: string; avatarUrl: string | null };
    ENS?: { handle: string; avatarUrl: string | null };
    Farcaster?: { handle: string; avatarUrl: string | null };
    Lens?: { handle: string; avatarUrl: string | null } | null;
  };
}

interface UserProfileDisplayProps {
  address: string;
  profile?: UserProfile;
  showAvatar?: boolean;
  avatarSize?: number;
  showAddress?: boolean;
  onAddressCopy?: (address: string) => void;
  className?: string;
}

const proxyImage = (url: string | null): string => {
  if (!url) return '';
  console.log("Proxying image:", url); // Add logging
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
};

const UserProfileDisplay: React.FC<UserProfileDisplayProps> = ({
  address,
  profile,
  showAvatar = true,
  avatarSize = 8, // Default to 8 (2rem)
  showAddress = true,
  onAddressCopy,
  className = '',
}) => {
  const [showCopiedTooltip, setShowCopiedTooltip] = useState(false);

  // Format address for display
  const formatAddress = (address: string): string => {
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  const handleAddressCopy = () => {
    if (onAddressCopy) {
      onAddressCopy(address);
    } else {
      navigator.clipboard.writeText(address)
        .then(() => {
          console.log('Address copied to clipboard');
        })
        .catch(err => {
          console.error('Failed to copy address: ', err);
        });
    }
    
    // Show tooltip
    setShowCopiedTooltip(true);
    // Hide tooltip after 2 seconds
    setTimeout(() => setShowCopiedTooltip(false), 2000);
  };

  // Convert avatarSize to pixels for consistent sizing
  const sizeInPixels = avatarSize * 4; // Multiply by 4 since Tailwind's spacing scale is 4px based

  return (
    <div className={`flex items-center ${className}`}>
      {showAvatar && (
        <div 
          className="rounded-full overflow-hidden bg-gray-200 flex items-center justify-center mr-2"
          style={{ width: `${sizeInPixels}px`, height: `${sizeInPixels}px` }}
        >
          {/* {false ? (
            <img src={proxyImage(profile.avatarUrl)} alt="Avatar" className="h-full w-full object-cover" />
          ) : ( */}
            <svg 
              className="text-gray-400" 
              style={{ width: `${sizeInPixels * 0.75}px`, height: `${sizeInPixels * 0.75}px` }}
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          {/* )} */}
        </div>
      )}
      
      <div className="flex flex-col">
        {profile?.displayName && (
          <div className="text-sm font-medium text-gray-900">
            {profile.displayName}
          </div>
        )}
        
        {showAddress && (
          <div className="relative">
            <button 
              onClick={handleAddressCopy}
              className="font-mono text-xs text-gray-500 hover:text-gray-700 flex items-center group"
              title="Click to copy address"
            >
              <span>{formatAddress(address)}</span>
              <svg 
                className="w-3 h-3 ml-1 opacity-0 group-hover:opacity-100 transition-opacity" 
                fill="none" 
                stroke="currentColor" 
                viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
              </svg>
            </button>
            
            {/* Copied tooltip */}
            <div
              className={`absolute -top-8 left-1/2 -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 transition-opacity duration-200 whitespace-nowrap ${
                showCopiedTooltip ? 'opacity-100' : ''
              }`}
            >
              Address copied
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default UserProfileDisplay;