import { buildAccumulationSchedule } from '../src/engine/accumulation.js';

function nearlyEqual(a, b, tol = 0.01) {
  return Math.abs(a - b) <= tol;
}

const rows = buildAccumulationSchedule({
  startAge: 54,
  endAge: 54,
  startBalance: 100000,
  concessionalCap: 32500,
  contributionsTax: 0.15,
  returnRate: 0.08,
});

if (!rows || rows.length !== 1) throw new Error('Expected exactly 1 row');

const r = rows[0];
// Net contrib = 32500 * (1-0.15) = 27625
if (!nearlyEqual(r.netContribution, 27625)) throw new Error('Net contribution mismatch');
// Balance before return = 127625
if (!nearlyEqual(r.openingBalance + r.netContribution, 127625)) throw new Error('Balance before return mismatch');
// Return = 127625 * 0.08 = 10210
if (!nearlyEqual(r.investmentReturn, 10210)) throw new Error('Investment return mismatch');
// Close = 137835
if (!nearlyEqual(r.closingBalance, 137835)) throw new Error('Closing balance mismatch');

console.log('✅ accumulation.test.mjs passed');
