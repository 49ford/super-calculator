/**
 * V6 Drawdown Engine
 *
 * Models retirement income drawdown using GROSS spend.
 *
 * Assumptions:
 * - Spend is gross (tax handled separately)
 * - Returns applied after withdrawal
 * - Exhaustion occurs when balance ≤ 0
 */

export function buildDrawdownSchedule(params) {
  const {
    startAge,
    endAge,
    startBalance,
    annualSpend,
    returnRate,
  } = params;

  const rows = [];
  let balance = startBalance;
  let exhaustedAtAge = null;

  for (let age = startAge; age <= endAge; age++) {
    const openingBalance = balance;

    const spend = Math.min(openingBalance, annualSpend);
    const afterSpendBalance = openingBalance - spend;

    const investmentReturn =
      afterSpendBalance > 0 ? afterSpendBalance * returnRate : 0;

    const closingBalance = afterSpendBalance + investmentReturn;

    if (closingBalance <= 0 && exhaustedAtAge === null) {
      exhaustedAtAge = age;
    }

    rows.push({
      age,
      openingBalance,
      spend,
      investmentReturn,
      closingBalance,
    });

    balance = Math.max(0, closingBalance);
  }

  return {
    exhaustedAtAge,
    rows,
  };
}
