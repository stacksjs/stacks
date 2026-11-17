/**
 * Post-purchase upsells: a discounted, one-time offer on the order
 * confirmation page that adds to the order just placed, with one click and no
 * second checkout.
 *
 * ```ts
 * import { upsells } from '@stacksjs/commerce'
 *
 * // On the thank-you page: what this order is offered (and record the view).
 * const offers = await upsells.presentOffers(order.id)
 *
 * // "Add to order": priced on the server, charged off-session, added atomically.
 * const result = await upsells.acceptOffer({
 *   orderId: order.id,
 *   offerId: offer.id,
 *   productId: 12,
 *   variantId: 40,
 *   quantity: 5,
 *   charge: upsells.chargeWith(paymentDriver(), { payer: user, paymentMethod: 'pm_...' }),
 * })
 * ```
 *
 * How one acceptance runs, and why in this order:
 *
 * 1. **Claim.** One transaction writes the response row as `pending` with the
 *    line priced from the database (never from the request) and reserves the
 *    stock. The unique `(order, offer, product)` index makes the offer
 *    one-time: a double click or a second tab finds the claim taken.
 * 2. **Charge.** Outside any transaction, since it is a network call. The
 *    idempotency key is fixed per claim, so a retried request cannot charge
 *    twice.
 * 3. **Finish.** A succeeded payment adds the order line, the payment row and
 *    the new totals in one transaction. A failed one releases the stock and
 *    leaves the offer open to try again while its window lasts. A payment that
 *    needs the shopper (3-D Secure) stays `pending` with its reference, and the
 *    payment webhook finishes it through {@link completeUpsellPayment}.
 *
 * Amounts are integer minor units of the order's currency.
 */

import type { PaymentDriver, Payer } from '@stacksjs/payments'
import { randomUUIDv7 } from 'bun'
import { db, mutationCount, sqlHelpers } from '@stacksjs/database/runtime'
import { env } from '@stacksjs/env'
import { formatDate, isUniqueViolation } from '@stacksjs/orm'
import { percentOf } from '../discounts/engine'

/** Order statuses an offer is never shown to or taken on. */
const CLOSED_ORDER_STATUSES = new Set(['CANCELLED', 'CANCELED', 'REFUNDED', 'FAILED'])

export interface OfferRow {
  id: number
  uuid?: string | null
  name: string
  headline?: string | null
  message?: string | null
  product_ids: string
  discount_percent?: number | string | null
  min_quantity?: number | null
  default_quantity?: number | null
  max_quantity?: number | null
  trigger_product_ids?: string | null
  min_order_total?: number | null
  window_minutes?: number | null
  priority?: number | null
  is_active?: number | boolean | null
  starts_at?: string | null
  ends_at?: string | null
}

export type ResponseStatus = 'viewed' | 'pending' | 'accepted' | 'declined' | 'failed'

export interface ResponseRow {
  id: number
  post_purchase_offer_id: number
  order_id: number
  status: ResponseStatus
  product_id: number
  variant_id?: number | null
  quantity?: number | null
  unit_price?: number | null
  compare_at_price?: number | null
  amount?: number | null
  currency?: string | null
  payment_reference?: string | null
  payment_provider?: string | null
  failure_reason?: string | null
  order_item_id?: number | null
  responded_at?: string | null
}

export interface UpsellVariantView {
  id: number
  /** The variant's own name ("Black / XL"). */
  name: string
  /** Its option kind ("Size", "Colour"), when it has one. */
  type: string | null
  /** Parsed `options` JSON, e.g. `{ colour: 'Black', size: 'XL' }`. */
  options: Record<string, unknown> | null
  unitPrice: number
  regularPrice: number
  /** Units left, or null when stock is not tracked. */
  inventory: number | null
  inStock: boolean
}

export interface UpsellProductView {
  productId: number
  name: string
  slug: string | null
  imageUrl: string | null
  description: string | null
  /** The offer price of one unit (without a variant, or the first variant's). */
  unitPrice: number
  /** The regular price the offer is taken off. */
  regularPrice: number
  percentOff: number
  variants: UpsellVariantView[]
  inventory: number | null
  inStock: boolean
  /** What this order already did with it. */
  status: ResponseStatus | null
}

export interface UpsellOfferView {
  offerId: number
  headline: string | null
  message: string | null
  discountPercent: number
  minQuantity: number
  defaultQuantity: number
  maxQuantity: number | null
  currency: string
  /** When the offer closes for this order (ISO 8601). */
  expiresAt: string
  products: UpsellProductView[]
}

/** Why an order does not qualify, or no longer does. */
export type IneligibleReason = 'order-not-found' | 'order-closed' | 'offer-not-found' | 'offer-inactive' | 'offer-expired' | 'not-eligible'

export interface UpsellChargeRequest {
  /** Minor units of `currency`. */
  amount: number
  /** ISO 4217, upper case as orders store it. */
  currency: string
  orderId: number
  offerId: number
  responseId: number
  /** Fixed per claim: hand it to the provider so a retry cannot charge twice. */
  idempotencyKey: string
  /** `upsell-<responseId>`: carry it as the payment's reference for reconciliation. */
  reference: string
  description: string
}

export interface UpsellChargeResult {
  status: 'succeeded' | 'processing' | 'requires_action' | 'requires_payment_method' | 'failed' | 'canceled'
  /** The provider's payment id (a PaymentIntent). */
  reference?: string | null
  provider?: string | null
  failureReason?: string | null
  /** For `requires_action`: what the browser needs to finish (Stripe.js client secret, ...). */
  clientConfirmation?: unknown
  redirectUrl?: string | null
}

/**
 * Takes the money for an accepted offer. `'collect-later'` adds the line
 * without taking a payment, for stores that invoice, take cash on delivery or
 * capture the whole order later; it is explicit so leaving the charge out can
 * never give goods away by accident.
 */
// eslint-disable-next-line pickier/no-unused-vars
export type UpsellCharger = ((request: UpsellChargeRequest) => Promise<UpsellChargeResult>) | 'collect-later'

export interface AcceptOfferInput {
  orderId: number
  offerId: number
  productId: number
  variantId?: number | null
  quantity: number
  charge: UpsellCharger
  /** Tax on the added amount, in minor units. Defaults to none. */
  taxFor?: (amount: number, order: Record<string, unknown>) => number
  now?: Date
}

export type AcceptOfferResult =
  | { ok: true, status: 'accepted', response: ResponseRow, orderItemId: number, order: Record<string, unknown> }
  /** The provider has the payment but has not confirmed it; the webhook finishes it. */
  | { ok: true, status: 'pending', response: ResponseRow }
  | { ok: false, reason: 'payment-requires-action', response: ResponseRow, clientConfirmation?: unknown, redirectUrl?: string | null }
  | { ok: false, reason: 'payment-failed', response: ResponseRow, message: string }
  | { ok: false, reason: IneligibleReason | 'invalid-product' | 'invalid-variant' | 'invalid-quantity' | 'already-responded' | 'out-of-stock', message: string }

const q = (): any => db as any

/** The offers an order qualifies for right now, highest priority first. */
export async function eligibleOffers(orderId: number, options: { now?: Date } = {}): Promise<OfferRow[]> {
  const now = options.now ?? new Date()
  const order = await loadOrder(orderId)
  if (!order || isOrderClosed(order))
    return []
  const items = await loadOrderProductIds(orderId)
  const offers = await q().selectFrom('post_purchase_offers').selectAll().execute() as OfferRow[]
  const responses = await loadResponses(orderId)

  return offers
    .filter(offer => checkEligibility(offer, order, items, now) === null)
    // An offer whose every product has been taken or turned down is done.
    .filter((offer) => {
      const productIds = parseIds(offer.product_ids)
      return productIds.some(pid => !responses.some(r => r.post_purchase_offer_id === offer.id && r.product_id === pid && (r.status === 'accepted' || r.status === 'declined')))
    })
    .sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0) || a.id - b.id)
}

/**
 * The offers to show on an order's confirmation page, priced and with their
 * variants and stock, recording a `viewed` response for each product shown so
 * conversion can be measured. `limit` defaults to one offer, the way a
 * post-purchase page shows a single proposition.
 */
export async function presentOffers(orderId: number, options: { now?: Date, limit?: number, record?: boolean } = {}): Promise<UpsellOfferView[]> {
  const now = options.now ?? new Date()
  const offers = (await eligibleOffers(orderId, { now })).slice(0, options.limit ?? 1)
  if (offers.length === 0)
    return []
  const order = (await loadOrder(orderId))!
  const currency = String(order.currency || 'USD').toUpperCase()
  const responses = await loadResponses(orderId)
  const views: UpsellOfferView[] = []

  for (const offer of offers) {
    const percent = Number(offer.discount_percent ?? 0)
    const products: UpsellProductView[] = []
    for (const productId of parseIds(offer.product_ids)) {
      const product = await q().selectFrom('products').where('id', '=', productId).selectAll().executeTakeFirst()
      if (!product || product.is_available === 0 || product.is_available === false)
        continue
      const variants = await loadVariants(productId)
      const base = Math.round(Number(product.price ?? 0))
      const variantViews: UpsellVariantView[] = variants.map((v) => {
        const regular = v.price != null ? Math.round(Number(v.price)) : base
        const inventory = v.inventory_count == null ? null : Number(v.inventory_count)
        return {
          id: Number(v.id),
          name: String(v.variant ?? ''),
          type: v.type ?? null,
          options: parseObject(v.options),
          unitPrice: regular - percentOf(regular, percent),
          regularPrice: regular,
          inventory,
          inStock: inventory == null || inventory > 0,
        }
      })
      const inventory = product.inventory_count == null ? null : Number(product.inventory_count)
      const lead = variantViews[0]
      const existing = responses.find(r => r.post_purchase_offer_id === offer.id && r.product_id === productId)
      products.push({
        productId,
        name: String(product.name ?? ''),
        slug: product.slug ?? null,
        imageUrl: product.image_url ?? null,
        description: product.description ?? null,
        unitPrice: lead ? lead.unitPrice : base - percentOf(base, percent),
        regularPrice: lead ? lead.regularPrice : base,
        percentOff: percent,
        variants: variantViews,
        inventory,
        inStock: variantViews.length ? variantViews.some(v => v.inStock) : (inventory == null || inventory > 0),
        status: existing?.status ?? null,
      })
      if (options.record !== false && !existing)
        await recordView(offer.id, orderId, productId)
    }
    if (products.length === 0)
      continue
    views.push({
      offerId: offer.id,
      headline: offer.headline ?? null,
      message: offer.message ?? null,
      discountPercent: percent,
      minQuantity: Number(offer.min_quantity ?? 1),
      defaultQuantity: Math.max(Number(offer.default_quantity ?? 1), Number(offer.min_quantity ?? 1)),
      maxQuantity: offer.max_quantity == null ? null : Number(offer.max_quantity),
      currency,
      expiresAt: new Date(offerClosesAt(offer, order)).toISOString(),
      products,
    })
  }
  return views
}

/**
 * Add an offered product to the order: claim, charge, finish. See the module
 * comment for the order of operations.
 */
export async function acceptOffer(input: AcceptOfferInput): Promise<AcceptOfferResult> {
  const now = input.now ?? new Date()
  if (!Number.isSafeInteger(input.quantity) || input.quantity < 1)
    return { ok: false, reason: 'invalid-quantity', message: 'Quantity must be a whole number of at least 1.' }

  const order = await loadOrder(input.orderId)
  if (!order)
    return { ok: false, reason: 'order-not-found', message: 'That order does not exist.' }
  const offer = await q().selectFrom('post_purchase_offers').where('id', '=', input.offerId).selectAll().executeTakeFirst() as OfferRow | undefined
  if (!offer)
    return { ok: false, reason: 'offer-not-found', message: 'That offer does not exist.' }

  const ineligible = isOrderClosed(order) ? 'order-closed' : checkEligibility(offer, order, await loadOrderProductIds(input.orderId), now)
  if (ineligible)
    return { ok: false, reason: ineligible, message: INELIGIBLE_MESSAGES[ineligible] }

  if (!parseIds(offer.product_ids).includes(input.productId))
    return { ok: false, reason: 'invalid-product', message: 'That product is not part of this offer.' }

  const minQuantity = Number(offer.min_quantity ?? 1)
  const maxQuantity = offer.max_quantity == null ? null : Number(offer.max_quantity)
  if (input.quantity < minQuantity || (maxQuantity != null && input.quantity > maxQuantity)) {
    return {
      ok: false,
      reason: 'invalid-quantity',
      message: maxQuantity == null ? `This offer needs at least ${minQuantity}.` : `This offer takes ${minQuantity} to ${maxQuantity}.`,
    }
  }

  const product = await q().selectFrom('products').where('id', '=', input.productId).selectAll().executeTakeFirst()
  if (!product || product.is_available === 0 || product.is_available === false)
    return { ok: false, reason: 'invalid-product', message: 'That product is no longer available.' }

  const variants = await loadVariants(input.productId)
  let variant: Record<string, any> | undefined
  if (variants.length > 0) {
    variant = variants.find(v => Number(v.id) === Number(input.variantId))
    if (!variant)
      return { ok: false, reason: 'invalid-variant', message: 'Choose one of this product\'s options.' }
  }
  else if (input.variantId != null) {
    return { ok: false, reason: 'invalid-variant', message: 'This product has no options to choose.' }
  }

  // Priced here, from the catalog, never from what the page posted.
  const regular = variant?.price != null ? Math.round(Number(variant.price)) : Math.round(Number(product.price ?? 0))
  const unitPrice = regular - percentOf(regular, Number(offer.discount_percent ?? 0))
  const amount = unitPrice * input.quantity
  const currency = String(order.currency || 'USD').toUpperCase()

  // 1. Claim the offer and reserve the stock, together.
  let response: ResponseRow
  try {
    response = await db.transaction(async (trx: any) => {
      const stamp = formatDate(now)
      const snapshot = {
        status: 'pending' as const,
        variant_id: variant ? Number(variant.id) : null,
        quantity: input.quantity,
        unit_price: unitPrice,
        compare_at_price: regular,
        amount,
        currency,
        payment_reference: null,
        payment_provider: null,
        failure_reason: null,
        responded_at: stamp,
        updated_at: stamp,
      }
      const claimed = await claimResponse(trx, offer.id, input.orderId, input.productId, snapshot, stamp)
      if (!claimed)
        throw Object.assign(new Error('already responded'), { __upsell: 'already-responded' })

      const reserved = await adjustStock(trx, input.productId, variant ? Number(variant.id) : null, -input.quantity, stamp)
      if (!reserved)
        throw Object.assign(new Error('out of stock'), { __upsell: 'out-of-stock' })

      return await trx.selectFrom('post_purchase_offer_responses').where('id', '=', claimed).selectAll().executeTakeFirst() as ResponseRow
    })
  }
  catch (err: any) {
    if (err?.__upsell === 'already-responded')
      return { ok: false, reason: 'already-responded', message: 'This offer has already been used on this order.' }
    if (err?.__upsell === 'out-of-stock')
      return { ok: false, reason: 'out-of-stock', message: 'Sorry, there is not enough of that left.' }
    throw err
  }

  // 2. Take the payment, outside any transaction.
  if (input.charge === 'collect-later')
    return await finishAccepted(response, { taxFor: input.taxFor })

  let charged: UpsellChargeResult
  try {
    charged = await input.charge({
      amount,
      currency,
      orderId: input.orderId,
      offerId: offer.id,
      responseId: response.id,
      idempotencyKey: `upsell-${response.id}-${toTime(response.responded_at) ?? response.id}`,
      reference: `upsell-${response.id}`,
      description: `${product.name ?? 'Item'} added to order #${input.orderId}`,
    })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failed = await failAcceptance(response.id, message)
    return { ok: false, reason: 'payment-failed', response: failed ?? response, message }
  }

  // 3. Finish according to what the provider said.
  if (charged.status === 'succeeded')
    return await finishAccepted(response, { reference: charged.reference, provider: charged.provider, taxFor: input.taxFor })

  if (charged.status === 'failed' || charged.status === 'canceled') {
    const message = charged.failureReason || 'The payment did not go through.'
    const failed = await failAcceptance(response.id, message)
    return { ok: false, reason: 'payment-failed', response: failed ?? response, message }
  }

  const pending = await recordPendingPayment(response.id, charged.reference ?? null, charged.provider ?? null)
  if (charged.status === 'processing')
    return { ok: true, status: 'pending', response: pending ?? response }
  return { ok: false, reason: 'payment-requires-action', response: pending ?? response, clientConfirmation: charged.clientConfirmation, redirectUrl: charged.redirectUrl ?? null }
}

/**
 * Finish a pending acceptance whose payment the provider has now settled.
 * Called by the payment webhook with the payment's reference: `succeeded`
 * adds the line to the order, anything else releases the stock. Answers
 * whether a pending acceptance matched, so other payments pass through.
 */
export async function completeUpsellPayment(reference: string, outcome: { succeeded: boolean, reason?: string | null, provider?: string | null }, options: { taxFor?: AcceptOfferInput['taxFor'] } = {}): Promise<boolean> {
  if (!reference)
    return false
  const response = await q()
    .selectFrom('post_purchase_offer_responses')
    .where('payment_reference', '=', reference)
    .selectAll()
    .executeTakeFirst() as ResponseRow | undefined
  if (!response || response.status !== 'pending')
    return false
  if (outcome.succeeded)
    await finishAccepted(response, { reference, provider: outcome.provider ?? response.payment_provider, taxFor: options.taxFor })
  else
    await failAcceptance(response.id, outcome.reason || 'The payment did not go through.')
  return true
}

/**
 * Fail acceptances left `pending` for longer than `olderThanMinutes` (default
 * 60) and put their stock back: a 3-D Secure prompt the shopper walked away
 * from would otherwise hold the items forever. Schedule it like the abandoned
 * cart sweeper. A payment that settles after this still reaches the webhook,
 * which finds nothing pending and leaves it for a person to refund.
 */
export async function releaseStalePending(options: { olderThanMinutes?: number, now?: Date } = {}): Promise<number> {
  const now = options.now ?? new Date()
  const cutoff = formatDate(new Date(now.getTime() - (options.olderThanMinutes ?? 60) * 60_000))
  const stale = await q()
    .selectFrom('post_purchase_offer_responses')
    .where('status', '=', 'pending')
    .where('updated_at', '<', cutoff)
    .select(['id'])
    .execute() as Array<{ id: number }>
  let released = 0
  for (const { id } of stale) {
    const row = await failAcceptance(Number(id), 'The payment was not completed in time.')
    if (row?.status === 'failed')
      released++
  }
  return released
}

/**
 * Turn an offer down for this order. Every product of it the shopper saw and
 * had not taken is marked declined. Answers how many were.
 */
export async function declineOffer(orderId: number, offerId: number, options: { now?: Date } = {}): Promise<number> {
  const stamp = formatDate(options.now ?? new Date())
  const result = await q()
    .updateTable('post_purchase_offer_responses')
    .set({ status: 'declined', responded_at: stamp, updated_at: stamp })
    .where('order_id', '=', orderId)
    .where('post_purchase_offer_id', '=', offerId)
    .where('status', 'in', ['viewed', 'failed'])
    .executeTakeFirst()
  return mutationCount(result)
}

export interface OfferStats {
  offerId: number | null
  /** Products shown, one per order and product. */
  views: number
  accepted: number
  declined: number
  pending: number
  failed: number
  /** Accepted over viewed, 0 to 1. */
  conversionRate: number
  /** Minor units added to orders by accepted offers. */
  revenue: number
  units: number
}

/** How an offer is doing, or every offer together without an id. */
export async function offerStats(offerId?: number): Promise<OfferStats> {
  let query = q().selectFrom('post_purchase_offer_responses').selectAll()
  if (offerId != null)
    query = query.where('post_purchase_offer_id', '=', offerId)
  const rows = await query.execute() as ResponseRow[]
  const count = (status: ResponseStatus) => rows.filter(r => r.status === status).length
  const accepted = rows.filter(r => r.status === 'accepted')
  return {
    offerId: offerId ?? null,
    views: rows.length,
    accepted: accepted.length,
    declined: count('declined'),
    pending: count('pending'),
    failed: count('failed'),
    conversionRate: rows.length ? accepted.length / rows.length : 0,
    revenue: accepted.reduce((s, r) => s + Number(r.amount ?? 0), 0),
    units: accepted.reduce((s, r) => s + Number(r.quantity ?? 0), 0),
  }
}

export interface ChargeWithOptions {
  /** Who paid for the original order, as the payment driver knows them. */
  payer: Payer
  /** The saved payment method to charge (`pm_...` on Stripe). */
  paymentMethod: string
}

/**
 * A charger that takes the money through a `@stacksjs/payments` driver,
 * off-session, on the payment method the original order was paid with.
 */
export function chargeWith(driver: PaymentDriver, options: ChargeWithOptions): Exclude<UpsellCharger, 'collect-later'> {
  return async (request) => {
    const result = await driver.charge(options.payer, { amount: request.amount, currency: request.currency.toLowerCase() }, options.paymentMethod, {
      idempotencyKey: request.idempotencyKey,
      reference: request.reference,
      description: request.description,
      metadata: { order_id: String(request.orderId), post_purchase_offer_id: String(request.offerId), post_purchase_offer_response_id: String(request.responseId) },
    })
    return {
      status: result.status,
      reference: result.id,
      provider: driver.name,
      failureReason: result.failureReason ?? null,
      clientConfirmation: result.clientConfirmation,
      redirectUrl: result.redirectUrl ?? null,
    }
  }
}

/**
 * A charger that takes the money from the payer's default saved payment
 * method (or their only one) through a payments driver. Throws, which
 * `acceptOffer` reports as a failed payment, when they have none on file.
 */
export function chargeDefaultMethod(driver: PaymentDriver, payer: Payer): Exclude<UpsellCharger, 'collect-later'> {
  return async (request) => {
    const methods = await driver.paymentMethods(payer)
    const method = methods.find(m => m.isDefault) ?? (methods.length === 1 ? methods[0] : undefined)
    if (!method)
      throw new Error('There is no saved payment method to charge.')
    return await chargeWith(driver, { payer, paymentMethod: method.id })(request)
  }
}

/** The response rows an order has, for showing what it already did. */
export async function responsesFor(orderId: number): Promise<ResponseRow[]> {
  return await loadResponses(orderId)
}

const INELIGIBLE_MESSAGES: Record<IneligibleReason, string> = {
  'order-not-found': 'That order does not exist.',
  'order-closed': 'This order can no longer be added to.',
  'offer-not-found': 'That offer does not exist.',
  'offer-inactive': 'This offer is not running.',
  'offer-expired': 'This offer has ended.',
  'not-eligible': 'This order does not qualify for that offer.',
}

/** Null when the order qualifies for the offer now, otherwise why not. */
function checkEligibility(offer: OfferRow, order: Record<string, any>, orderProductIds: readonly number[], now: Date): IneligibleReason | null {
  if (offer.is_active === 0 || offer.is_active === false)
    return 'offer-inactive'
  const starts = toTime(offer.starts_at)
  const ends = toTime(offer.ends_at)
  if (starts !== null && now.getTime() < starts)
    return 'offer-inactive'
  if (ends !== null && now.getTime() > ends)
    return 'offer-expired'
  if (now.getTime() > offerClosesAt(offer, order))
    return 'offer-expired'
  if (offer.min_order_total != null && Number(order.total_amount ?? 0) < Number(offer.min_order_total))
    return 'not-eligible'
  const triggers = parseIds(offer.trigger_product_ids)
  if (triggers.length && !triggers.some(id => orderProductIds.includes(id)))
    return 'not-eligible'
  if (parseIds(offer.product_ids).length === 0)
    return 'not-eligible'
  return null
}

/** When the offer closes for an order: placed at plus the offer's window. */
function offerClosesAt(offer: OfferRow, order: Record<string, any>): number {
  const placed = toTime(order.created_at) ?? Date.now()
  return placed + Number(offer.window_minutes ?? 30) * 60_000
}

function isOrderClosed(order: Record<string, any>): boolean {
  return CLOSED_ORDER_STATUSES.has(String(order.status ?? '').toUpperCase())
}

/**
 * Take the claim on `(offer, order, product)`. A fresh row is inserted; an
 * existing one moves to `pending` only from `viewed` or `failed`, in one
 * conditional UPDATE, so of two racing requests exactly one wins. Answers the
 * row id, or null when the claim is already taken or settled.
 */
async function claimResponse(trx: any, offerId: number, orderId: number, productId: number, snapshot: Record<string, unknown>, stamp: string): Promise<number | null> {
  const where = (query: any) => query
    .where('order_id', '=', orderId)
    .where('post_purchase_offer_id', '=', offerId)
    .where('product_id', '=', productId)

  const existing = await where(trx.selectFrom('post_purchase_offer_responses').selectAll()).executeTakeFirst() as ResponseRow | undefined
  if (!existing) {
    try {
      await trx.insertInto('post_purchase_offer_responses').values({
        post_purchase_offer_id: offerId,
        order_id: orderId,
        product_id: productId,
        created_at: stamp,
        ...snapshot,
      }).execute()
      const row = await where(trx.selectFrom('post_purchase_offer_responses').selectAll()).executeTakeFirst() as ResponseRow | undefined
      return row ? Number(row.id) : null
    }
    catch (err) {
      if (!isUniqueViolation(err))
        throw err
    }
  }

  const result = await where(trx.updateTable('post_purchase_offer_responses').set(snapshot))
    .where('status', 'in', ['viewed', 'failed'])
    .executeTakeFirst()
  if (mutationCount(result) === 0)
    return null
  const row = await where(trx.selectFrom('post_purchase_offer_responses').selectAll()).executeTakeFirst() as ResponseRow | undefined
  return row ? Number(row.id) : null
}

/**
 * Move stock by `delta` (negative to reserve), guarded in the WHERE clause:
 * untracked stock (NULL) always passes, tracked stock never goes below zero.
 * A variant holds its own stock; a product without variants holds it itself.
 */
async function adjustStock(trx: any, productId: number, variantId: number | null, delta: number, stamp: string): Promise<boolean> {
  const p = sqlHelpers(env.DB_CONNECTION || 'sqlite').param
  const table = variantId != null ? 'product_variants' : 'products'
  const id = variantId ?? productId
  const statement = await trx.unsafe(
    `UPDATE ${table}
      SET inventory_count = CASE WHEN inventory_count IS NULL THEN NULL ELSE inventory_count + ${p(1)} END,
          updated_at = ${p(2)}
      WHERE id = ${p(3)}
        AND (inventory_count IS NULL OR inventory_count + ${p(4)} >= 0)`,
    [delta, stamp, id, delta],
  )
  return mutationCount(statement) > 0
}

/**
 * Add a claimed line to its order: the order item, the payment row when one
 * was taken, the order's new totals and the response marked accepted, all in
 * one transaction. The status guard makes it safe to call twice (a webhook
 * retry, a webhook racing the request that charged): the second call finds
 * nothing pending and returns what the first did.
 */
async function finishAccepted(response: ResponseRow, payment: { reference?: string | null, provider?: string | null, taxFor?: AcceptOfferInput['taxFor'] }): Promise<AcceptOfferResult> {
  const now = formatDate(new Date())
  const outcome = await db.transaction(async (trx: any) => {
    const order = await trx.selectFrom('orders').where('id', '=', response.order_id).selectAll().executeTakeFirst()
    if (!order)
      throw new Error(`Order ${response.order_id} disappeared while finishing an upsell.`)

    const moved = await trx
      .updateTable('post_purchase_offer_responses')
      .set({ status: 'accepted', payment_reference: payment.reference ?? response.payment_reference ?? null, payment_provider: payment.provider ?? response.payment_provider ?? null, updated_at: now })
      .where('id', '=', response.id)
      .where('status', '=', 'pending')
      .executeTakeFirst()
    if (mutationCount(moved) === 0)
      return null

    const amount = Number(response.amount ?? 0)
    const tax = Math.max(0, Math.round(payment.taxFor?.(amount, order) ?? 0))

    await trx.insertInto('order_items').values({
      order_id: response.order_id,
      product_id: response.product_id,
      quantity: Number(response.quantity),
      price: Number(response.unit_price),
      special_instructions: `Post-purchase offer #${response.post_purchase_offer_id}${response.variant_id ? `, variant #${response.variant_id}` : ''}`,
      created_at: now,
      updated_at: now,
    }).execute()
    const item = await trx
      .selectFrom('order_items')
      .where('order_id', '=', response.order_id)
      .where('product_id', '=', response.product_id)
      .orderBy('id', 'desc')
      .selectAll()
      .executeTakeFirst()

    await trx
      .updateTable('orders')
      .set({
        total_amount: Number(order.total_amount ?? 0) + amount + tax,
        tax_amount: Number(order.tax_amount ?? 0) + tax,
        updated_at: now,
      })
      .where('id', '=', response.order_id)
      .execute()

    if (payment.reference) {
      await trx.insertInto('payments').values({
        uuid: randomUUIDv7(),
        order_id: response.order_id,
        customer_id: order.customer_id ?? null,
        amount: amount + tax,
        currency: response.currency ?? order.currency ?? 'USD',
        method: 'creditCard',
        status: 'succeeded',
        transaction_id: payment.reference,
        payment_provider: payment.provider ?? null,
        reference_number: `upsell-${response.id}`,
        created_at: now,
        updated_at: now,
      }).execute()
    }

    await trx
      .updateTable('post_purchase_offer_responses')
      .set({ order_item_id: item?.id ?? null })
      .where('id', '=', response.id)
      .execute()

    return {
      order: await trx.selectFrom('orders').where('id', '=', response.order_id).selectAll().executeTakeFirst(),
      response: await trx.selectFrom('post_purchase_offer_responses').where('id', '=', response.id).selectAll().executeTakeFirst() as ResponseRow,
      orderItemId: Number(item?.id),
    }
  })

  if (!outcome) {
    const current = await q().selectFrom('post_purchase_offer_responses').where('id', '=', response.id).selectAll().executeTakeFirst() as ResponseRow
    const order = await loadOrder(response.order_id)
    return { ok: true, status: 'accepted', response: current, orderItemId: Number(current?.order_item_id), order: order ?? {} }
  }

  void emitUpsellAccepted(outcome.order, outcome.response)
  return { ok: true, status: 'accepted', response: outcome.response, orderItemId: outcome.orderItemId, order: outcome.order }
}

/** Mark a pending acceptance failed and put its stock back. */
async function failAcceptance(responseId: number, reason: string): Promise<ResponseRow | undefined> {
  const stamp = formatDate(new Date())
  return await db.transaction(async (trx: any) => {
    const response = await trx.selectFrom('post_purchase_offer_responses').where('id', '=', responseId).selectAll().executeTakeFirst() as ResponseRow | undefined
    if (!response)
      return undefined
    const moved = await trx
      .updateTable('post_purchase_offer_responses')
      .set({ status: 'failed', failure_reason: reason.slice(0, 1000), updated_at: stamp })
      .where('id', '=', responseId)
      .where('status', '=', 'pending')
      .executeTakeFirst()
    if (mutationCount(moved) > 0 && response.quantity)
      await adjustStock(trx, response.product_id, response.variant_id ?? null, Number(response.quantity), stamp)
    return await trx.selectFrom('post_purchase_offer_responses').where('id', '=', responseId).selectAll().executeTakeFirst() as ResponseRow
  })
}

async function recordPendingPayment(responseId: number, reference: string | null, provider: string | null): Promise<ResponseRow | undefined> {
  await q()
    .updateTable('post_purchase_offer_responses')
    .set({ payment_reference: reference, payment_provider: provider, updated_at: formatDate(new Date()) })
    .where('id', '=', responseId)
    .where('status', '=', 'pending')
    .execute()
  return await q().selectFrom('post_purchase_offer_responses').where('id', '=', responseId).selectAll().executeTakeFirst() as ResponseRow | undefined
}

async function recordView(offerId: number, orderId: number, productId: number): Promise<void> {
  const stamp = formatDate(new Date())
  try {
    await q().insertInto('post_purchase_offer_responses').values({
      post_purchase_offer_id: offerId,
      order_id: orderId,
      product_id: productId,
      status: 'viewed',
      created_at: stamp,
      updated_at: stamp,
    }).execute()
  }
  catch (err) {
    // Shown twice (a refresh, a second tab): the first view stands.
    if (!isUniqueViolation(err))
      throw err
  }
}

async function emitUpsellAccepted(order: Record<string, unknown>, response: ResponseRow): Promise<void> {
  try {
    const mod = await import('@stacksjs/events').catch(() => null)
    const dispatch = (mod as { dispatch?: (t: string, p: unknown) => void } | null)?.dispatch
    if (typeof dispatch === 'function')
      dispatch('order:upsell-accepted', { order, response })
  }
  catch {
    // A notification side channel; never undoes the write.
  }
}

async function loadOrder(orderId: number): Promise<Record<string, any> | undefined> {
  return await q().selectFrom('orders').where('id', '=', orderId).selectAll().executeTakeFirst()
}

async function loadOrderProductIds(orderId: number): Promise<number[]> {
  const rows = await q().selectFrom('order_items').where('order_id', '=', orderId).select(['product_id']).execute() as Array<{ product_id: number | null }>
  return rows.map(r => Number(r.product_id)).filter(Number.isSafeInteger)
}

async function loadResponses(orderId: number): Promise<ResponseRow[]> {
  return await q().selectFrom('post_purchase_offer_responses').where('order_id', '=', orderId).selectAll().execute() as ResponseRow[]
}

async function loadVariants(productId: number): Promise<Array<Record<string, any>>> {
  const rows = await q().selectFrom('product_variants').where('product_id', '=', productId).selectAll().orderBy('id', 'asc').execute() as Array<Record<string, any>>
  return rows.filter(v => v.status == null || !['inactive', 'archived', 'draft'].includes(String(v.status).toLowerCase()))
}

function parseIds(raw: string | null | undefined): number[] {
  if (!raw)
    return []
  try {
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.map(Number).filter(n => Number.isSafeInteger(n) && n > 0) : []
  }
  catch {
    return []
  }
}

function parseObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === '')
    return null
  if (typeof raw === 'object')
    return raw as Record<string, unknown>
  try {
    const parsed = JSON.parse(String(raw))
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : null
  }
  catch {
    return null
  }
}

function toTime(value: unknown): number | null {
  if (value == null || value === '')
    return null
  const time = value instanceof Date ? value.getTime() : Date.parse(asUtc(String(value)))
  return Number.isFinite(time) ? time : null
}

/**
 * Timestamps are stored as `YYYY-MM-DD HH:MM:SS` in UTC (`formatDate`), with
 * no zone. `Date.parse` would read that as local time and move every window
 * by the server's offset, so a zone-less date-time is read as UTC.
 */
function asUtc(value: string): string {
  const trimmed = value.trim()
  return /^\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?$/.test(trimmed) ? `${trimmed.replace(' ', 'T')}Z` : trimmed
}
