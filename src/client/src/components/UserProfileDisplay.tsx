import React, { useState, useEffect } from 'react';
import Address from './Address';
import axios from 'axios';

export interface UserProfile {
  address: string;
  handle: string | null;
  avatarUrl: string | null;
}

interface UserProfileDisplayProps {
  address: string;
  showAvatar?: boolean;
  avatarSize?: number;
  showAddress?: boolean;
  onAddressCopy?: (address: string) => void;
  className?: string;
}

const proxyImage = (url: string | null): string => {
  if (!url) return '';
  return `/api/proxy-image?url=${encodeURIComponent(url)}`;
};

const UserProfileDisplay: React.FC<UserProfileDisplayProps> = ({
  address,
  showAvatar = true,
  avatarSize = 8, // Default to 8 (2rem)
  showAddress = true,
  onAddressCopy,
  className = '',
}) => {
  const [showCopiedTooltip, setShowCopiedTooltip] = useState(false);
  const [profileData, setProfileData] = useState<{ handle: string | null; avatarUrl: string | null }>({
    handle: null,
    avatarUrl: null
  });
  const [isLoading, setIsLoading] = useState(false);

  // Fetch profile data when address changes
  useEffect(() => {
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(`/superfluid/resolve/${address}`);
        setProfileData({
          handle: response.data.handle || null,
          avatarUrl: response.data.avatarUrl || null
        });
      } catch (error) {
        console.error('Error fetching profile:', error);
        setProfileData({ handle: null, avatarUrl: null });
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile()
  }, [address]);

  const handleAddressCopy = () => {
    if (onAddressCopy) {
      onAddressCopy(address);
      
      // Show tooltip
      setShowCopiedTooltip(true);
      // Hide tooltip after 2 seconds
      setTimeout(() => setShowCopiedTooltip(false), 2000);
    }
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
          {profileData.avatarUrl ? (
            <img src={proxyImage(profileData.avatarUrl)} alt="Avatar" className="h-full w-full object-cover" />
          ) : (
            <svg 
              className="text-gray-400" 
              style={{ width: `${sizeInPixels * 0.75}px`, height: `${sizeInPixels * 0.75}px` }}
              fill="currentColor" 
              viewBox="0 0 20 20"
            >
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          )}
        </div>
      )}
      
      <div className="flex flex-col">
        {profileData.handle && (
          <div className="text-sm font-medium text-gray-900">
            {profileData.handle}
          </div>
        )}
        
        {showAddress && (
          <Address 
            address={address} 
            nameOverride={profileData.handle || undefined}
            showTooltip={false}
            copyable={!!onAddressCopy}
            className="text-xs"
            onAddressCopy={onAddressCopy}
            noname
          />
        )}
      </div>
    </div>
  );
};

export default UserProfileDisplay;