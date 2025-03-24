export interface PointSystemEligibility {
  pointSystemId: number;
  pointSystemName: string;
  eligible: boolean;
  points: number;
  claimedAmount: number;
  needToClaim: boolean;
  gdaPoolAddress: string;
  estimatedFlowRate: number;
}

export interface AddressEligibility {
  address: string;
  eligibility: PointSystemEligibility[];
  claimNeeded: boolean;
  hasAllocations: boolean;
  totalFlowRate?: number;
}

export interface EligibilityResponse {
  results: AddressEligibility[];
} 