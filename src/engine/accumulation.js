/**
 * V6 Accumulation Engine
 *
 * Models superannuation balance growth during working years.
 *
 * Assumptions:
 * - Forecast years always contribute the full concessional cap
 * - Contributions taxed at concessional rate
 * - Returns applied to opening balance + net contributions
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

  const rows = [];
  let balance = startBalance;

  for (let age = startAge; age <= endAge; age++) {
    const openingBalance = balance;

    const concessionalContribution = concessionalCap;
    const contributionsTaxAmount = concessionalContribution * contributionsTax;
    const netContribution = concessionalContribution - contributionsTaxAmount;

    const balanceBeforeReturn = openingBalance + netContribution;
    const investmentReturn = balanceBeforeReturn * returnRate;

    const closingBalance = balanceBeforeReturn + investmentReturn;

    rows.push({
      age,
      openingBalance,
      concessionalContribution,
      contributionsTax: contributionsTaxAmount,
      netContribution,
      investmentReturn,
      closingBalance,
    });

    balance = closingBalance;
  }

  return rows;
}
``
