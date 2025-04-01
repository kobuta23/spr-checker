# V2 Upgrade Changes

## Eligibility Check & Point Assignment

When a user checks their eligibility status through the API, the system will now automatically make them eligible if they meet certain criteria:

### Eligibility Flow
1. User requests eligibility check via `/eligibility` endpoint
2. System checks current point balance across all point systems
3. For each point system:
   - If user has >= 99 points: No additional points assigned
   - If user has < 99 points: System assigns 99 new points
   - If user has 0 points: System assigns 99 new points

### Implementation Details

The eligibility service will be modified to:
1. First fetch current allocations from Stack API
2. For each address and point system:
   - Check current point balance
   - If points < 100, make API call to Stack to assign 100 points (in the Community Activation campaign)
   - Don't wait for success. Return updated eligibility status immediately

### Technical Changes Required

1. Update `eligibilityService.ts`:
   - Add point assignment logic in `checkEligibility()` method
   - Add new method `assignPoints()` to handle Stack API point assignment

2. Update Stack API Service:
   - Add new method for point assignment API calls
   - Handle authentication and error cases

3. Add configuration:
   - New environment variables for Stack API write access
   - Point threshold configuration (99 points)

### Security Considerations

- Rate limiting should be implemented
- Stack API write access tokens must be secured
- Audit logs for point assignments
