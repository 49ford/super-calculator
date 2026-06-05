import { calculateTax } from '../src/engine/tax.js';

const acc = calculateTax({
  phase: 'accumulation',
  concessionalContribution: 10000,
  concessionalTaxRate: 0.15,
});

if (acc.tax !== 1500) throw new Error('Accumulation tax incorrect');
if (acc.netAmount !== 8500) throw new Error('Accumulation net incorrect');

const pen = calculateTax({
  phase: 'pension',
});

if (pen.tax !== 0) throw new Error('Pension tax should be zero');

console.log('✅ tax.test.mjs passed');
