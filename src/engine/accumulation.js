/**
 * V6 Accumulation Engine
 *
 * Models superannuation balance growth during working years.
 *
 * Key assumptions:
 * - Forecast years always contribute the full concessional cap.
 * - Contributions are taxed at the concessional contributions tax rate.
 * - Returns are applied to opening balance + net contributions.
 *
 * Source:
 * - super-calculator-v4 2.html (reference implementation)
 * - Retirement Plan 2023.xlsx
 *
 * @param {Object} params
 * @param {number} params.startAge            Age at start of projection
 * @param {number} params.endAge              Age at retirement
 * @param {number} params.startBalance        Opening super balance
 * @param {number} params.concessionalCap     Annual concessional cap
 * @param {number} params.contributionsTax    Contributions tax rate (e.g. 0.15)
 * @param {number} params.returnRate          Annual investment return (decimal, e.g. 0.08)
 *
 * @returns {Array<Object>} rows
 *   Each row represents one age / financial year with:
 *   - age
 *   - openingBalance
 *   - concessionalContribution
 *   - contributionsTax
 *   - netContribution
 *   - investmentReturn
 *   - closingBalance
 */
export function buildAccumulationSchedule(params) {
  const {
    startAge,
    endAge,
    startBalance,
    concessionalCap,
    contributionsTax,
    returnRate,
  } = params;

  // First year only (single-row implementation)
  const openingBalance = startBalance;

  const concessionalContribution = concessionalCap;
  const contributionsTaxAmount = concessionalContribution * contributionsTax;
  const netContribution = concessionalContribution - contributionsTaxAmount;

  const balanceBeforeReturn = openingBalance + netContribution;
  const investmentReturn = balanceBeforeReturn * returnRate;

  const closingBalance = balanceBeforeReturn + investmentReturn;

  return [
    {
      age: startAge,
      openingBalance,
      concessionalContribution,
      contributionsTax: contributionsTaxAmount,
      netContribution,
      investmentReturn
