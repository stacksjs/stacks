/** Allocate a requested refund against its original cash and account-credit tenders. */
export function allocateRefund(amount: number, cashRemaining: number, creditRemaining: number): { cash: number, credit: number } {
  if (![amount, cashRemaining, creditRemaining].every(value => Number.isSafeInteger(value) && value >= 0) || amount < 1 || amount > cashRemaining + creditRemaining)
    throw new Error('Refund amount exceeds remaining refundable amount')
  const cash = Math.min(amount, cashRemaining)
  return { cash, credit: amount - cash }
}

/** Difference of cumulative rounded tax keeps split refunds equal to a full refund. */
export function refundTaxDelta(before: number, amount: number, total: number, tax: number): number {
  if (![before, amount, total, tax].every(value => Number.isSafeInteger(value) && value >= 0) || before + amount > total)
    throw new Error('Invalid refund tax amounts')
  if (total === 0) return 0
  return Math.round((before + amount) * tax / total) - Math.round(before * tax / total)
}
