import { buildDrawdownSchedule } from '../src/engine/drawdown.js';

const result = buildDrawdownSchedule({
  startAge: 60,
  endAge: 62,
  startBalance: 100000,
  annualSpend: 40000,
  returnRate: 0.05,
});

const rows = result.rows;

if (rows.length !== 3) throw new Error('Expected 3 drawdown rows');

if (rows[0].openingBalance !== 100000) {
  throw new Error('Opening balance incorrect');
}

if (rows[0].spend !== 40000) {
  throw new Error('Spend calculation incorrect');
}

if (rows[2].closingBalance < 0) {
  throw new Error('Balance should not go negative');
}

console.log('✅ drawdown.test.mjs passed');
