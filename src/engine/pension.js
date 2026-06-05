/**
 * V6 Pension Engine
 *
 * Simplified Age Pension model:
 * - Assets test
 * - Income test (deeming)
 * - Pension = min(assets test, income test)
 *
 * Figures are annual, couple combined.
 */

export function estimateAgePension(params) {
  const {
    financialAssets,
    homeowner,
    fullPension,
    assetThreshold,
    assetTaperPerDollar,
    deemingThreshold,
    deemingRateLow,
    deemingRateHigh,
    incomeFreeArea,
    incomeTaperRate,
  } = params;

  // --- Assets test ---
  const excessAssets = Math.max(0, financialAssets - assetThreshold);
  const assetReduction = excessAssets * assetTaperPerDollar;
  const pensionByAssets = Math.max(0, fullPension - assetReduction);

  // --- Income test (deeming) ---
  let deemedIncome;
  if (financialAssets <= deemingThreshold) {
    deemedIncome = financialAssets * deemingRateLow;
  } else {
    deemedIncome =
      deemingThreshold * deemingRateLow +
      (financialAssets - deemingThreshold) * deemingRateHigh;
  }

  const excessIncome = Math.max(0, deemedIncome - incomeFreeArea);
  const incomeReduction = excessIncome * incomeTaperRate;
  const pensionByIncome = Math.max(0, fullPension - incomeReduction);

  return Math.min(pensionByAssets, pensionByIncome);
}
