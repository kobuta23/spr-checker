import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface PointSystem {
  id: number;
  name: string;
  gdaPoolAddress: string;
  flowrate: number;
  totalUnits: number;
}

// Define point systems with their IDs and GDA pool addresses
const pointSystems: PointSystem[] = [
  {
    id: 7370,
    name: 'Community Activations',
    gdaPoolAddress: '0xB7d7331529dC6fb68CB602d9B738CabD84d3ae6d',
    flowrate: 1607510288065843368,
    totalUnits: 0
  },
  {
    id: 7584,
    name: 'AlfaFrens',
    gdaPoolAddress: '0x0ac6aCe504CF4583dE327808834Aaf8AA3294FE3',
    flowrate: 1607510288065843621,
    totalUnits: 0
  },
  {
    id: 7585,
    name: 'SuperBoring',
    gdaPoolAddress: '0xbeF36F4D3fC9b96A5eD5002a3308F768B44Cef7e',
    flowrate: 1286008230452674897,
    totalUnits: 0
  },
  {
    id: 7587,
    name: 'Donations',
    gdaPoolAddress: '0xAAc36Fe22DC97C1942000A13a3967D8ef1aB11f4',
    flowrate: 321502057613168724,
    totalUnits: 0
  },
  {
    id: 7586,
    name: 'Payments',
    gdaPoolAddress: '0x5640003112EEaAd042D055D27072e8261d28FCe4',
    flowrate: 902475598864699132,
    totalUnits: 0
  },
  {
    id: 7246,
    name: 'GoodDollar',
    gdaPoolAddress: '0x17A9ca096295472b7Ae1ECe9c7C5ad8248B9FF3d',
    flowrate: 643004115226337429,
    totalUnits: 0
  }
];

const config = {
  port: process.env.PORT || 9900,
  nodeEnv: process.env.NODE_ENV || 'development',
  ethereumRpcUrl: process.env.ETHEREUM_RPC_URL || 'https://mainnet.base.org',
  slackWebhookUrl: process.env.SLACK_WEBHOOK_URL || '',
  stackApiBaseUrl: process.env.STACK_API_BASE_URL || 'https://athena.stack.so',
  pointSystems,
  GDAForwarder: "0x6DA13Bde224A05a288748d857b9e7DDEffd1dE08",
  lockerFactoryAddress: "0xA6694cAB43713287F7735dADc940b555db9d39D9"
};

export default config; 