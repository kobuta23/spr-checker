import { UserProfile } from '../../components/UserProfileDisplay';

export interface StackActivity {
  identity: {
    address: string;
    ensName: string | null;
    farcasterUsername: string | null;
    lensHandle: string | null;
    farcasterPfpUrl: string | null;
  };
  events: {
    eventType: string;
    timestamp: string;
    points: number;
  }[];
  aggregates: {
    eventType: string;
    totalPoints: number;
    count: number;
    firstTimestamp: string;
    lastTimestamp: string;
  }[];
}

export interface ExpandedActivities {
  [key: string]: { // key is `${pointSystemId}-${address}`
    isLoading: boolean;
    error: string | null;
    data: StackActivity | null;
  }
}

export interface ActivityPoint {
  points: number;
  flowrate: string;
}

export interface FlowrateBreakdownProps {
  dataList: any[]; // Will be replaced with AddressEligibility[] when we import the type
  userProfiles: Record<string, UserProfile>;
  onAddressCopy: (address: string) => void;
  onRemoveUser: (address: string) => void;
  onAddAddress: (address: string) => void;
  isLoading: boolean;
  timeUnit?: 'day' | 'month';
  onTimeUnitChange?: (unit: 'day' | 'month') => void;
} 