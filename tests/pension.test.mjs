import { estimateAgePension } from '../src/engine/pension.js';

const pension = estimateAgePension({
  financialAssets: 500000,
  homeowner: true,
  fullPension: 45000,
  assetThreshold: 470000,
  assetTaperPerDollar: 0.078, // $78 per $1,000 ≈ 0.078 per $
  deemingThreshold: 100000,
  deemingRateLow: 0.0025,
  deemingRateHigh: 0.0225,
  incomeFreeArea: 9000,
  incomeTaperRate: 0.5,
});

if (pension <= 0 || pension >= 45000) {
  throw new Error('Pension calculation out of expected range');
}

console.log('✅ pension.test.mjs passed');
