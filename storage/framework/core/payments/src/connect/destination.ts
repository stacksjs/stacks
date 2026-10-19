import type Stripe from 'stripe'
import { requireAccountId } from './account'

/**
 * Destination-charge parameters, built pure.
 *
 * A marketplace sale is a charge on the platform that Stripe settles to a
 * merchant's connected account, less the platform's application fee. The
 * same three or four fields say so on every Stripe object that can charge,
 * but each spells them differently:
 *
 * | Where the money is taken                 | Fields                                                   |
 * |------------------------------------------|----------------------------------------------------------|
 * | Checkout, `mode: 'payment'`              | `payment_intent_data.{transfer_data, application_fee_amount, on_behalf_of}` |
 * | Checkout, `mode: 'subscription'`         | `subscription_data.{transfer_data, application_fee_percent, on_behalf_of}`  |
 * | `stripe.subscriptions.create`            | `transfer_data`, `application_fee_percent`, `on_behalf_of` |
 * | `stripe.paymentIntents.create`           | `transfer_data`, `application_fee_amount`, `on_behalf_of` |
 *
 * A one-off charge carries its fee as an AMOUNT, a subscription as a PERCENT
 * (Stripe applies it to every invoice, whatever prorations, coupons and
 * trials make of the total). These builders take one options shape for all
 * four, validate it, and return only the Connect fields, typed with Stripe's
 * own parameter types, to spread into the params you are already building.
 * They read no config and call no API, so they are safe in a unit test and
 * in a request handler alike.
 */

/** How a percentage fee becomes whole minor units. */
export type FeeRounding = 'round' | 'floor'

export interface DestinationOptions {
  /** The merchant's connected account (`acct_...`) the money settles to. */
  destination: string

  /**
   * The platform's cut as a percentage (0 to 100). On a one-off charge it is
   * turned into an amount with `rounding`; on a subscription it is sent as
   * Stripe's `application_fee_percent`, which takes at most two decimals.
   */
  feePercent?: number

  /**
   * The platform's cut in minor units. Wins over `feePercent` on a one-off
   * charge; a subscription cannot carry one and refuses it.
   */
  feeCents?: number

  /**
   * Settle as the merchant (Stripe's `on_behalf_of`): their statement
   * descriptor on the buyer's card and their country's settlement rules.
   */
  onBehalfOf?: boolean

  /**
   * `'floor'` (the default, matching `applicationFeeFor`) never charges a
   * fraction of a cent the platform did not earn; `'round'` takes the nearest
   * cent. Neither can exceed the charge, because the percent is at most 100.
   */
  rounding?: FeeRounding

  /** Ties a one-off charge to its transfers for reporting (`transfer_group`). */
  transferGroup?: string
}

/** The Connect fields of a one-off charge. */
export type DestinationPaymentFields = Pick<Stripe.PaymentIntentCreateParams, 'transfer_data' | 'application_fee_amount' | 'on_behalf_of' | 'transfer_group'>

/** The Connect fields of a subscription created directly. */
export type DestinationSubscriptionFields = Pick<Stripe.SubscriptionCreateParams, 'transfer_data' | 'application_fee_percent' | 'on_behalf_of'>

function fail(message: string): never {
  throw new Error(`[payments/connect] ${message}`)
}

function checkPercent(percent: number): void {
  if (!Number.isFinite(percent) || percent < 0 || percent > 100)
    fail(`feePercent must be between 0 and 100, got ${percent}`)
}

/**
 * The platform's fee on a one-off charge of `amount` minor units: `feeCents`
 * when given, else `feePercent` of the amount, rounded as asked. 0 means take
 * nothing. Throws for a negative, fractional or larger-than-the-charge fee.
 *
 * @example
 * destinationFeeCents(1999, { feePercent: 7.5 })                     // 149
 * destinationFeeCents(1999, { feePercent: 7.5, rounding: 'round' })  // 150
 */
export function destinationFeeCents(amount: number, options: Pick<DestinationOptions, 'feePercent' | 'feeCents' | 'rounding'> = {}): number {
  if (!Number.isSafeInteger(amount) || amount < 0)
    fail(`a charge amount is a non-negative whole number of minor units, got ${amount}`)

  if (options.feeCents != null) {
    if (!Number.isSafeInteger(options.feeCents) || options.feeCents < 0)
      fail(`feeCents must be a non-negative whole number of minor units, got ${options.feeCents}`)
    if (options.feeCents > amount)
      fail(`feeCents ${options.feeCents} exceeds the charge amount ${amount}`)
    return options.feeCents
  }

  if (options.feePercent == null) return 0
  checkPercent(options.feePercent)
  const exact = (amount * options.feePercent) / 100
  // Snap float noise first: 18.4% of 375 computes as 68.99999999999999, which would floor to 68.
  const snapped = Math.abs(exact - Math.round(exact)) < 1e-9 ? Math.round(exact) : exact
  const rounding = options.rounding ?? 'floor'
  if (rounding !== 'floor' && rounding !== 'round') fail(`rounding must be 'round' or 'floor', got ${String(rounding)}`)
  return Math.min(amount, rounding === 'round' ? Math.round(snapped) : Math.floor(snapped))
}

/**
 * A subscription's fee percent as Stripe takes it (at most two decimals), or
 * undefined to take nothing. Float noise from adding two percents
 * (`0.1 + 0.2`) is snapped; a genuinely finer value is refused rather than
 * rounded into a fee nobody configured.
 */
export function destinationFeePercent(options: Pick<DestinationOptions, 'feePercent' | 'feeCents'> = {}): number | undefined {
  if (options.feeCents != null)
    fail('a subscription takes its fee as feePercent (Stripe applies it to every invoice), not feeCents')
  if (options.feePercent == null) return undefined
  checkPercent(options.feePercent)
  const hundredths = options.feePercent * 100
  if (Math.abs(hundredths - Math.round(hundredths)) > 1e-6)
    fail(`feePercent takes at most two decimal places on a subscription, got ${options.feePercent}`)
  const percent = Math.round(hundredths) / 100
  return percent > 0 ? percent : undefined
}

function common(options: DestinationOptions, caller: string): { transfer_data: { destination: string }, on_behalf_of?: string } {
  if (!options || typeof options !== 'object') fail(`${caller} requires options with a destination`)
  requireAccountId(options.destination, caller)
  return {
    transfer_data: { destination: options.destination },
    ...(options.onBehalfOf ? { on_behalf_of: options.destination } : {}),
  }
}

/**
 * The Connect fields of a PaymentIntent for `amount` minor units, to spread
 * into `stripe.paymentIntents.create(...)`.
 *
 * @example
 * await stripe.paymentIntents.create({ amount: 4900, currency: 'eur', customer, ...destinationPaymentIntentParams(4900, { destination, feePercent: 10 }) })
 */
export function destinationPaymentIntentParams(amount: number, options: DestinationOptions): DestinationPaymentFields {
  const base = common(options, 'destinationPaymentIntentParams')
  const fee = destinationFeeCents(amount, options)
  return {
    ...base,
    ...(fee > 0 ? { application_fee_amount: fee } : {}),
    ...(options.transferGroup ? { transfer_group: options.transferGroup } : {}),
  }
}

/**
 * `payment_intent_data` for a Checkout Session in `mode: 'payment'` whose
 * line items total `amount` minor units (see `checkoutLineItemsTotal`).
 * Pass `extra` for the session's other PaymentIntent fields (metadata, a
 * description); the Connect fields win over it.
 *
 * @example
 * await stripe.checkout.sessions.create({
 *   mode: 'payment',
 *   line_items,
 *   payment_intent_data: destinationCheckoutPaymentData(checkoutLineItemsTotal(line_items), { destination, feePercent: 5, rounding: 'round' }, { metadata }),
 *   success_url, cancel_url,
 * })
 */
export function destinationCheckoutPaymentData(
  amount: number,
  options: DestinationOptions,
  extra: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {},
): Stripe.Checkout.SessionCreateParams.PaymentIntentData {
  const base = common(options, 'destinationCheckoutPaymentData')
  const fee = destinationFeeCents(amount, options)
  const rest = { ...extra }
  delete rest.application_fee_amount
  return {
    ...rest,
    ...base,
    ...(fee > 0 ? { application_fee_amount: fee } : {}),
    ...(options.transferGroup ? { transfer_group: options.transferGroup } : {}),
  }
}

/**
 * `subscription_data` for a Checkout Session in `mode: 'subscription'`: each
 * paid invoice settles to the merchant less `feePercent`. Pass `extra` for
 * the subscription's other fields (metadata, `trial_period_days`).
 */
export function destinationCheckoutSubscriptionData(
  options: DestinationOptions,
  extra: Stripe.Checkout.SessionCreateParams.SubscriptionData = {},
): Stripe.Checkout.SessionCreateParams.SubscriptionData {
  const base = common(options, 'destinationCheckoutSubscriptionData')
  const percent = destinationFeePercent(options)
  const rest = { ...extra }
  delete rest.application_fee_percent
  return {
    ...rest,
    ...base,
    ...(percent != null ? { application_fee_percent: percent } : {}),
  }
}

/**
 * The Connect fields of a subscription created with
 * `stripe.subscriptions.create(...)`, for a member who already has a payment
 * method on file.
 *
 * @example
 * await stripe.subscriptions.create({ customer, items: [{ price }], ...destinationSubscriptionParams({ destination, feePercent: 2.5 }) })
 */
export function destinationSubscriptionParams(options: DestinationOptions): DestinationSubscriptionFields {
  const base = common(options, 'destinationSubscriptionParams')
  const percent = destinationFeePercent(options)
  return { ...base, ...(percent != null ? { application_fee_percent: percent } : {}) }
}

/**
 * The total of Checkout line items defined with `price_data`, in minor
 * units: the amount a `mode: 'payment'` session will charge, before tax and
 * discounts. A line that names a catalog `price` has no amount here, so it is
 * refused rather than counted as zero; pass the amount yourself for those.
 */
export function checkoutLineItemsTotal(lineItems: readonly Stripe.Checkout.SessionCreateParams.LineItem[]): number {
  let total = 0
  for (const item of lineItems) {
    const unit = item.price_data?.unit_amount
    if (unit == null) fail('checkoutLineItemsTotal counts price_data lines only; a catalog price has no amount here')
    const quantity = item.quantity ?? 1
    if (!Number.isSafeInteger(unit) || unit < 0 || !Number.isSafeInteger(quantity) || quantity < 0)
      fail('a line item needs a whole unit_amount and quantity')
    total += unit * quantity
  }
  if (!Number.isSafeInteger(total)) fail('line items total more than a safe integer')
  return total
}

/**
 * Split a fee (or any amount of minor units) into named shares by weight, so
 * the shares always add up to the amount exactly.
 *
 * Each share gets its whole part, and the cents left over go one each to the
 * shares with the largest fractions (ties to the earlier key). A negative
 * amount, a refunded fee, splits the same way with every share negated. When
 * every weight is 0 the whole amount goes to `fallback` (the first key unless
 * named): a fee taken under weights since set to nothing still belongs
 * somewhere.
 *
 * @example
 * splitFee(101, { tip: 2, planet: 1 })   // { tip: 67, planet: 34 }
 * splitFee(-101, { tip: 2, planet: 1 })  // { tip: -67, planet: -34 }
 * splitFee(50, { tip: 0, planet: 0 })    // { tip: 50, planet: 0 }
 */
export function splitFee<K extends string>(amount: number, weights: Readonly<Record<K, number>>, fallback?: K): Record<K, number> {
  if (!Number.isSafeInteger(amount)) fail(`splitFee expects a whole number of minor units, got ${amount}`)
  const keys = Object.keys(weights) as K[]
  if (!keys.length) fail('splitFee needs at least one share')
  for (const key of keys) {
    const weight = weights[key]
    if (!Number.isFinite(weight) || weight < 0) fail(`share "${key}" needs a non-negative weight, got ${weight}`)
  }
  if (fallback != null && !keys.includes(fallback)) fail(`fallback "${fallback}" is not one of the shares`)

  const result = Object.fromEntries(keys.map(key => [key, 0])) as Record<K, number>
  const sign = amount < 0 ? -1 : 1
  const whole = Math.abs(amount)
  const totalWeight = keys.reduce((sum, key) => sum + weights[key], 0)
  if (totalWeight === 0) {
    result[fallback ?? keys[0]!] = amount
    return result
  }

  const exact = keys.map(key => (whole * weights[key]) / totalWeight)
  const floors = exact.map(value => Math.floor(value + 1e-9))
  let left = whole - floors.reduce((sum, value) => sum + value, 0)
  const order = keys.map((_, index) => index).sort((a, b) => (exact[b]! - floors[b]!) - (exact[a]! - floors[a]!) || a - b)
  for (const index of order) {
    if (left <= 0) break
    floors[index]! += 1
    left--
  }
  keys.forEach((key, index) => {
    result[key] = sign * floors[index]! || 0
  })
  return result
}
