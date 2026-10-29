/** Canonical provider totals, after discounts. A missing/incomplete calculation
 * is never equivalent to zero tax. Shared by draft fees and issued credits. */
export function invoiceTaxAmounts(value: {
  total: number
  total_excluding_tax: number | null
  total_taxes: Array<{ amount: number }> | null
  automatic_tax?: { enabled: boolean, status: string | null }
}): { gross: number, net: number, tax: number } {
  const gross = value.total
  const net = value.total_excluding_tax
  if (!Number.isSafeInteger(gross) || gross < 0 || net == null || !Number.isSafeInteger(net) || net < 0 || net > gross)
    throw new Error('[payments/connect] Provider has no valid tax-exclusive amount')
  const tax = gross - net
  if (!Array.isArray(value.total_taxes) || value.total_taxes.some(row => !Number.isSafeInteger(row.amount) || row.amount < 0) || value.total_taxes.reduce((sum, row) => sum + row.amount, 0) !== tax)
    throw new Error('[payments/connect] Provider tax amounts do not balance')
  if (value.automatic_tax?.enabled && value.automatic_tax.status !== 'complete')
    throw new Error('[payments/connect] Provider tax calculation is not complete')
  return { gross, net, tax }
}
