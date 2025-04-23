import React, { useState } from 'react';
import { useEffect } from 'react';
import axios from 'axios';

interface AddressProps {
  address: string;
  nameOverride?: string;
  showFull?: boolean;
  className?: string;
  copyable?: boolean;
  showTooltip?: boolean;
  showProfileIcon?: boolean;
  onAddressCopy?: (address: string) => void;
}

/**
 * Address component for displaying Ethereum addresses with name resolution
 * 
 * Features:
 * - ENS name resolution or shortened address display
 * - Click-to-copy functionality with tooltip
 * - Optional name override (e.g., for Discord usernames)
 * - Option to show full address
 */
const Address: React.FC<AddressProps> = ({
  address,
  nameOverride,
  showFull = false,
  className = '',
  copyable = true,
  showTooltip = true,
  showProfileIcon = false,
  onAddressCopy,
  noname = false,
}) => {
  const [resolvedName, setResolvedName] = useState<string | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Format address for display
  const formatAddress = (address: string): string => {
    if (!address) return '';
    if (showFull) return address;
    return `${address.substring(0, 6)}...${address.substring(address.length - 4)}`;
  };

  // Handle copying address to clipboard
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent any parent click handlers from firing
    
    if (!copyable) return;
    
    // Use custom handler if provided
    if (onAddressCopy) {
      onAddressCopy(address);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000);
      return;
    }
    
    // Otherwise use browser clipboard API
    navigator.clipboard.writeText(address)
      .then(() => {
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
      })
      .catch(err => {
        console.error('Failed to copy address:', err);
      });
  };

  // Fetch profile from Superfluid API
  useEffect(() => {
    // Skip resolution ONLY if name is explicitly overridden with a non-null value
    if (nameOverride !== undefined && nameOverride !== null && !noname) return;
    
    const fetchProfile = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(`/superfluid/resolve/${address}`);
        // Use ENS name if available
        console.log("Resolved information in address component", response);
        console.log("Fetching name for address component", response.data);
        setResolvedName(response.data.handle);
        
      } catch (error) {
        console.error('Error fetching profile:', error);
        setResolvedName(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, [address, nameOverride]);

  // Determine display text
  let displayText;
  if (noname) {
    displayText = formatAddress(address);
  } else {
    displayText = nameOverride || resolvedName || formatAddress(address);
  }

  // Set class based on whether this is a name or address
  const isName = Boolean(nameOverride || resolvedName);
  const textClasses = isName
    ? 'font-medium text-gray-800'
    : 'font-mono text-gray-500';

  return (
    <div 
      className={`relative inline-flex items-center ${className}`}
      title={showFull ? '' : address}
    >
      {showProfileIcon && isName && (
        <div className="mr-1 text-blue-500">
          <svg 
            xmlns="http://www.w3.org/2000/svg" 
            className="h-4 w-4" 
            viewBox="0 0 20 20" 
            fill="currentColor"
          >
            <path 
              fillRule="evenodd" 
              d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" 
              clipRule="evenodd" 
            />
          </svg>
        </div>
      )}
      
      {isLoading ? (
        <span className="animate-pulse bg-gray-200 rounded h-5 w-24"></span>
      ) : (
        <span
          onClick={handleCopy}
          className={`${textClasses} ${copyable ? 'cursor-pointer hover:text-indigo-600' : ''}`}
        >
          {displayText}
        </span>
      )}
      
      {copyable && (
        <div 
          className="ml-1 text-gray-400 hover:text-indigo-500 cursor-pointer"
          onClick={handleCopy}
        >
          <svg 
            className="h-4 w-4" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24" 
            xmlns="http://www.w3.org/2000/svg"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth={2} 
              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" 
            />
          </svg>
        </div>
      )}
      
      {showTooltip && (
        <div 
          className={`absolute -top-8 left-1/2 transform -translate-x-1/2 px-2 py-1 bg-gray-900 text-white text-xs rounded transition-opacity duration-200 ${
            isCopied ? 'opacity-100' : 'opacity-0 pointer-events-none'
          }`}
        >
          Copied!
        </div>
      )}
    </div>
  );
};

export default Address; 