import request from 'supertest';
import app from '../src/app';

// Mock the services
jest.mock('../src/services/eligibilityService', () => ({
  __esModule: true,
  default: {
    checkEligibility: jest.fn().mockImplementation((addresses: string[]) => {
      return Promise.resolve(
        addresses.map(address => ({
          address,
          eligibility: [
            {
              pointSystemId: 7370,
              pointSystemName: 'Community Activations',
              eligible: true,
              allocation: '100',
              claimed: false,
              gdaPoolAddress: '0xB7d7331529dC6fb68CB602d9B738CabD84d3ae6d'
            },
            {
              pointSystemId: 7584,
              pointSystemName: 'AlfaFrens',
              eligible: false,
              allocation: '0',
              claimed: false,
              gdaPoolAddress: '0x0ac6aCe504CF4583dE327808834Aaf8AA3294FE3'
            }
          ]
        }))
      );
    })
  }
}));

describe('Eligibility API', () => {
  describe('GET /api/eligibility', () => {
    it('should return 400 if no addresses are provided', async () => {
      const response = await request(app).get('/api/eligibility');
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('should return 400 if invalid addresses are provided', async () => {
      const response = await request(app).get('/api/eligibility?addresses=invalid');
      expect(response.status).toBe(400);
      expect(response.body.error).toBe('Bad Request');
    });

    it('should return eligibility data for valid addresses', async () => {
      const response = await request(app).get('/api/eligibility?addresses=0x1234567890123456789012345678901234567890');
      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(1);
      expect(response.body.results[0].address).toBe('0x1234567890123456789012345678901234567890');
      expect(response.body.results[0].eligibility).toHaveLength(2);
    });

    it('should handle multiple addresses', async () => {
      const response = await request(app).get(
        '/api/eligibility?addresses=0x1234567890123456789012345678901234567890,0x2345678901234567890123456789012345678901'
      );
      expect(response.status).toBe(200);
      expect(response.body.results).toHaveLength(2);
    });
  });

  describe('GET /health', () => {
    it('should return 200 OK', async () => {
      const response = await request(app).get('/health');
      expect(response.status).toBe(200);
      expect(response.body.status).toBe('ok');
    });
  });
}); 