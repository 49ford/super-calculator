import { buildAccumulationSchedule } from '../src/engine/accumulation.js';

const rows = buildAccumulationSchedule({
  startAge: 54,
  endAge: 60,
  startBalance: 820000,
  concessionalCap: 32500,
  contributionsTax: 0.15,
  returnRate: 0.08,
});

console.table(rows);
