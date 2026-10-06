import { describe, expect, it } from 'bun:test'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { INVOICE_LIST_EXPAND } from '../src/billable/invoice'
import { SUBSCRIPTION_CREATE_EXPAND } from '../src/billable/subscription'

/**
 * The paths Stacks asks Stripe to expand must exist on the API version the
 * installed SDK pins. An expand string is not typechecked, so when Stripe
 * removed `Invoice.payment_intent` (API 2025-03-31.basil) both of these kept
 * asking for it, and Stripe refused: every new subscription and every invoice
 * listing failed. Read against the SDK's own declaration of the Invoice.
 */
const require = createRequire(import.meta.url)
const sdkRoot = dirname(require.resolve('stripe/package.json'))
const invoiceTypes = readFileSync(join(sdkRoot, 'cjs/resources/Invoices.d.ts'), 'utf8')

/** The top-level fields of `interface Invoice`, by the SDK's own declaration. */
function invoiceFields(): Set<string> {
  const start = invoiceTypes.indexOf('export interface Invoice {')
  expect(start).toBeGreaterThan(-1)
  const fields = new Set<string>()
  let depth = 0
  for (const line of invoiceTypes.slice(start).split('\n')) {
    if (depth === 1) {
      const field = /^\s{4}(\w+)\??:/.exec(line)
      if (field)
        fields.add(field[1]!)
    }
    depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length
    if (depth === 0 && fields.size > 0)
      break
  }
  return fields
}

describe('Stripe expand paths', () => {
  const fields = invoiceFields()

  it('reads the Invoice fields the installed SDK declares', () => {
    expect(fields.has('customer')).toBe(true)
    expect(fields.has('payment_intent')).toBe(false)
  })

  it('expands the first invoice\'s confirmation secret, not its removed payment intent', () => {
    expect(SUBSCRIPTION_CREATE_EXPAND).toEqual(['latest_invoice.confirmation_secret'])
    expect(fields.has('confirmation_secret')).toBe(true)
  })

  it('lists invoices with their payments, not their removed payment intent', () => {
    expect(INVOICE_LIST_EXPAND).toEqual(['data.payments'])
    expect(fields.has('payments')).toBe(true)
  })
})
