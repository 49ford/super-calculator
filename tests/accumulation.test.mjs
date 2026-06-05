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

if (!rows || rows.length !== 1) {
  throw new Error('Expected exactly 1 accumulation row');
}

const r = rows[0];

// Net contribution = 32,500 × (1 − 0.15) = 27,625
if (!nearlyEqual(r.netContribution, 27625)) {
  throw new Error('Net contribution calculation failed');
}

// Balance before return = 100,000 + 27,625
if (!nearlyEqual(r.openingBalance + r.netContribution, 127625)) {
  throw new Error('Balance before return incorrect');
}

// Investment return = 127,625 × 8%
if (!nearlyEqual(r.investmentReturn, 10210)) {
  throw new Error('Investment return calculation failed');
}

// Closing balance
if (!nearlyEqual(r.closingBalance, 137835)) {
  throw new Error('Closing balance calculation failed');
}

console.log('✅ accumulation.test.mjs passed');
