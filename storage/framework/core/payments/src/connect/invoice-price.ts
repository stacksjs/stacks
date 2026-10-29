import type Stripe from 'stripe'
import { stripe } from '../drivers/stripe'
import { idempotencyFingerprint, stacksIdempotencyKey } from '../idempotency'
import { asAccount } from './direct'

export interface DirectInvoicePriceOptions {
  /** Stable merchant offer/revision identity, without customer information. */
  reference: string
  name: string
  amount: number
  currency: string
  taxCode: string
  interval?: 'day' | 'week' | 'month' | 'year'
  intervalCount?: number
}

/** Find or create an inclusive catalog price on the original merchant. Stripe's
 * unique lookup key survives the idempotency window and lost create responses.
 * Different commercial terms receive a different immutable price. Existing
 * prices are verified, never silently edited/reactivated or transferred from
 * another lookup key. The merchant supplies its actual tax classification.
 */
export async function ensureDirectInvoicePrice(account: string, options: DirectInvoicePriceOptions, client: Pick<Stripe, 'prices'> = stripe): Promise<Stripe.Price> {
  const request = asAccount(account)
  if (typeof options.reference !== 'string' || !/^[a-z0-9:._-]{1,160}$/i.test(options.reference) || typeof options.name !== 'string' || !options.name.trim() || options.name.length > 250 || !Number.isSafeInteger(options.amount) || options.amount <= 0 || !/^[a-z]{3}$/i.test(options.currency) || !/^txcd_\d{8}$/.test(options.taxCode) || (options.interval !== undefined && !['day', 'week', 'month', 'year'].includes(options.interval)) || (options.intervalCount !== undefined && (!options.interval || !Number.isSafeInteger(options.intervalCount) || options.intervalCount < 1)))
    throw new Error('[payments/connect] Expected stable offer identity, name, positive minor-unit price, currency and merchant tax code')
  const terms = { reference: options.reference, name: options.name.trim(), amount: options.amount, currency: options.currency.toLowerCase(), taxCode: options.taxCode, interval: options.interval ?? null, intervalCount: options.interval ? options.intervalCount ?? 1 : null }
  const fingerprint = idempotencyFingerprint(terms)
  const lookup = `stacks.invoice-price.${fingerprint}`
  const listed = await client.prices.list({ lookup_keys: [lookup], limit: 100 }, request)
  if (listed.has_more || listed.data.length > 1)
    throw new Error('[payments/connect] Merchant invoice price lookup is ambiguous')
  const previous = listed.data[0]
  const price = previous ?? await client.prices.create({
    currency: terms.currency, unit_amount: terms.amount, tax_behavior: 'inclusive', lookup_key: lookup,
    metadata: { stacks_invoice_price: fingerprint, stacks_offer_reference: terms.reference },
    product_data: { name: terms.name, tax_code: terms.taxCode, metadata: { stacks_invoice_price: fingerprint, stacks_offer_reference: terms.reference } },
    ...(options.interval ? { recurring: { interval: options.interval, interval_count: options.intervalCount ?? 1 } } : {}),
  }, { ...request, idempotencyKey: stacksIdempotencyKey('connect.invoice.price', account, fingerprint) })
  if (!/^price_[a-z0-9_]+$/i.test(price.id)) throw new Error('[payments/connect] Provider returned no catalog price identity')
  const current = await client.prices.retrieve(price.id, { expand: ['product'] }, request)
  const product = current.product
  const recurring = current.recurring
  if (current.id !== price.id || !current.active || current.lookup_key !== lookup || current.metadata?.stacks_invoice_price !== fingerprint || current.currency !== terms.currency || current.unit_amount !== terms.amount || current.tax_behavior !== 'inclusive' || current.type !== (terms.interval ? 'recurring' : 'one_time') || (terms.interval ? !recurring || recurring.interval !== terms.interval || recurring.interval_count !== terms.intervalCount || recurring.usage_type !== 'licensed' : recurring != null) || typeof product === 'string' || product.deleted || !product.active || product.name !== terms.name || (typeof product.tax_code === 'string' ? product.tax_code : product.tax_code?.id) !== terms.taxCode)
    throw new Error('[payments/connect] Existing merchant price differs from the frozen inclusive offer or is inactive')
  return current
}
