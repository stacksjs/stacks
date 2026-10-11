import { formatCurrency } from './money'

/** One line of a purchase, as a receipt shows it. */
export interface ReceiptTextLine {
  name: string
  /** Defaults to 1. Shown as "2 × Name" when more than one. */
  quantity?: number
  /** The line's total in minor units (cents), not the unit price. */
  amountMinor: number
}

/**
 * A purchase's lines as plain text, one per line, for a receipt email or
 * text: `2 × Day pass: €20.00`. Amounts are formatted for `locale` in the
 * order's `currency`, so a receipt never shows a bare number.
 *
 * Browser-safe; pairs with the `order_receipt` template from
 * `@stacksjs/notifications/templates`.
 */
export function receiptLinesText(lines: ReceiptTextLine[], currency: string, locale?: string): string {
  return lines
    .map((line) => {
      const quantity = Math.max(1, Math.trunc(Number(line.quantity ?? 1)) || 1)
      const name = String(line.name || '').replace(/\s+/g, ' ').trim()
      return `${quantity > 1 ? `${quantity} × ` : ''}${name}: ${formatCurrency(line.amountMinor, currency, locale)}`
    })
    .join('\n')
}
