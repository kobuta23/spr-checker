// Stack API response types
export interface StackAllocation {
  pointSystemUuid: string;
  accountAddress: string;
  points: number;
  maxCreatedAt: string;
  allocation: bigint;
}

export interface StackApiResponse {
  res: {
    total: number;
    allocations: StackAllocation[];
  };
}

// Combined eligibility data
export interface PointSystemEligibility {
  pointSystemId: number;
  pointSystemName: string;
  eligible: boolean;
  allocation: string;
  claimedAmount: string;
  needToClaim: boolean;
  gdaPoolAddress: string;
}

export interface AddressEligibility {
  address: string;
  eligibility: PointSystemEligibility[];
  claimNeeded: boolean;
  hasAllocations: boolean;
}

// API response types
export interface EligibilityResponse {
  results: AddressEligibility[];
}

// Error response
export interface ErrorResponse {
  error: string;
  message: string;
  statusCode: number;
} 