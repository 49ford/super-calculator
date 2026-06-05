import { buildAccumulationSchedule } from './engine/accumulation.js';
import { buildDrawdownSchedule } from './engine/drawdown.js';
import { estimatePension } from './engine/pension.js';
import { applyTax } from './engine/tax.js';

// Temporary runner to validate engines during V6 build
export function runV6TestScenario() {
  const accumulation = buildAccumulationSchedule({
    startAge: 54,
    endAge: 60,
    startBalance: 820_000,
    concessionalCap: 32_500,
    contributionsTax: 0.15,
    returnRate: 0.08,
  });

  console.log('Accumulation result:', accumulation);

  // drawdown, pension, tax will be added incrementally
}
