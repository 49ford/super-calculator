/**
 * V6 Tax Engine (simplified)
 * - Concessional contributions taxed at 15%
 * - Pension phase withdrawals assumed tax-free (age 60+)
 */
export function calculateTax({ phase, concessionalContribution = 0, concessionalTaxRate = 0.15 }) {
  if (phase === 'accumulation') {
    const tax = concessionalContribution * concessionalTaxRate;
    return { tax, netAmount: concessionalContribution - tax };
  }
  if (phase === 'pension') {
    return { tax: 0, netAmount: 0 };
  }
  throw new Error('Unknown tax phase');
}
