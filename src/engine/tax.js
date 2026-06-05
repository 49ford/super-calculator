/**
 * V6 Tax Engine
 *
 * Handles simplified Australian super tax rules:
 * - Concessional contributions taxed at 15%
 * - Pension phase withdrawals assumed tax-free (age 60+)
 *
 * Designed to be extended later if legislation changes.
 */

export function calculateTax(params) {
  const {
    phase,                 // 'accumulation' | 'pension'
    concessionalContribution = 0,
    concessionalTaxRate = 0.15,
  } = params;

  if (phase === 'accumulation') {
    const tax = concessionalContribution * concessionalTaxRate;
    return {
      tax,
      netAmount: concessionalContribution - tax,
    };
  }

  if (phase === 'pension') {
    return {
      tax: 0,
      netAmount: 0,
    };
  }

  throw new Error('Unknown tax phase');
}
