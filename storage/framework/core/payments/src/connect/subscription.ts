import type { UserModel } from '@stacksjs/orm'
import type Stripe from 'stripe'
import { config } from '@stacksjs/config'
import { manageCheckout } from '../billable/checkout'
import { manageCustomer } from '../billable/customer'
import { requireAccountId } from './account'

/**
 * Destination subscriptions: a merchant's recurring price, billed by the
 * platform and settled to the merchant's connected account.
 *
 * The subscription, its customer and its invoices live on the platform, the
 * same as a destination charge, so one webhook endpoint sees every renewal,
 * failed payment and cancellation, and refunds and disputes stay with the
 * platform. Each paid invoice transfers to `transfer_data.destination`, less
 * `application_fee_percent` (a percentage, unlike a one-off charge's fee
 * amount, because Stripe applies it to every invoice whatever its total:
 * prorations, a coupon's discount, a trial's zero).
 *
 * Cancel, resume and read these with `manageSubscription` like any other
 * platform subscription; nothing about them needs the connected account's
 * credentials.
 */

/** Billing periods Stripe accepts for a recurring price. */
export type SubscriptionInterval = 'day' | 'week' | 'month' | 'year'

/** A recurring price defined at checkout rather than in the catalog. */
export interface InlineRecurringPrice {
  /** Per period, in minor units. */
  amount: number
  currency: string
  interval: SubscriptionInterval
  /** Bill every N intervals (every 3 months is `month` with 3). Default 1. */
  intervalCount?: number
  /** What the buyer sees on Checkout, the invoice and their receipt. */
  productName: string
  productDescription?: string
}

export interface DestinationSubscriptionCheckoutOptions {
  /** The merchant's connected account (`acct_...`) each invoice settles to. */
  destination: string

  /** A catalog price id (`price_...`), or a recurring price defined here. */
  price: string | InlineRecurringPrice

  quantity?: number

  /** Free days before the first invoice. Stripe allows 1 to 730. */
  trialDays?: number

  /**
   * The platform's cut of every invoice, as a percentage. Falls back to
   * `config.payment.connect.platformFeePercent`; 0 or nothing takes nothing.
   */
  platformFeePercent?: number

  /**
   * Settle as the merchant: their statement descriptor on the buyer's card
   * and their country's settlement rules (Stripe's `on_behalf_of`). Off by
   * default, matching `destinationCharge`.
   */
  onBehalfOf?: boolean

  /** Copied onto the Checkout Session and the subscription it creates. */
  metadata?: Record<string, string>

  /** Your record's id, echoed back on `checkout.session.completed`. */
  clientReferenceId?: string

  /** The platform customer to bill; resolved from the user when omitted. */
  customer?: string

  /** Return URLs, on the app's origin (checked by `manageCheckout.create`). */
  successUrl: string
  cancelUrl: string

  /** Any other Checkout Session parameter, applied last. */
  sessionParams?: Partial<Stripe.Checkout.SessionCreateParams>
}

export interface ManageDestinationSubscription {
  feePercentFor: (options?: { platformFeePercent?: number }) => number | undefined
  subscriptionData: (destination: string, options?: Pick<DestinationSubscriptionCheckoutOptions, 'trialDays' | 'platformFeePercent' | 'onBehalfOf' | 'metadata'>) => Stripe.Checkout.SessionCreateParams.SubscriptionData
  lineItem: (price: string | InlineRecurringPrice, quantity?: number) => Stripe.Checkout.SessionCreateParams.LineItem
  checkout: (user: UserModel, options: DestinationSubscriptionCheckoutOptions) => Promise<Stripe.Response<Stripe.Checkout.Session>>
  destinationOf: (subscription: { transfer_data?: { destination?: string | { id?: string } | null } | null }) => string | null
}

const INTERVALS: readonly SubscriptionInterval[] = ['day', 'week', 'month', 'year']

function configuredFeePercent(): number | undefined {
  const cfg = (config as { payment?: { connect?: { platformFeePercent?: number } } }) || {}
  return cfg.payment?.connect?.platformFeePercent
}

export const manageDestinationSubscription: ManageDestinationSubscription = (() => {
  /**
   * The platform's percentage of each invoice, or undefined to take nothing.
   * Stripe takes up to two decimal places, so a finer value is refused
   * rather than rounded into a fee nobody configured.
   */
  function feePercentFor(options: { platformFeePercent?: number } = {}): number | undefined {
    const percent = options.platformFeePercent ?? configuredFeePercent()
    if (percent == null) return undefined

    if (!Number.isFinite(percent) || percent < 0 || percent > 100)
      throw new Error(`[payments/connect] platformFeePercent must be between 0 and 100, got ${percent}`)

    if (Math.round(percent * 100) !== percent * 100)
      throw new Error(`[payments/connect] platformFeePercent takes at most two decimal places, got ${percent}`)

    return percent > 0 ? percent : undefined
  }

  /** The `subscription_data` that makes a Checkout subscription settle to a merchant. */
  function subscriptionData(
    destination: string,
    options: Pick<DestinationSubscriptionCheckoutOptions, 'trialDays' | 'platformFeePercent' | 'onBehalfOf' | 'metadata'> = {},
  ): Stripe.Checkout.SessionCreateParams.SubscriptionData {
    requireAccountId(destination, 'destinationSubscription')

    if (options.trialDays != null && (!Number.isInteger(options.trialDays) || options.trialDays < 1 || options.trialDays > 730))
      throw new Error(`[payments/connect] trialDays must be a whole number from 1 to 730, got ${options.trialDays}`)

    const fee = feePercentFor({ platformFeePercent: options.platformFeePercent })
    return {
      transfer_data: { destination },
      ...(fee != null ? { application_fee_percent: fee } : {}),
      ...(options.onBehalfOf ? { on_behalf_of: destination } : {}),
      ...(options.trialDays ? { trial_period_days: options.trialDays } : {}),
      ...(options.metadata ? { metadata: options.metadata } : {}),
    }
  }

  /** One Checkout line for a catalog price or an inline recurring price. */
  function lineItem(price: string | InlineRecurringPrice, quantity = 1): Stripe.Checkout.SessionCreateParams.LineItem {
    if (!Number.isInteger(quantity) || quantity < 1)
      throw new Error(`[payments/connect] quantity must be a positive whole number, got ${quantity}`)

    if (typeof price === 'string') {
      if (!price.startsWith('price_'))
        throw new Error(`[payments/connect] a catalog price id starts with "price_", got "${price}"`)
      return { price, quantity }
    }

    if (!Number.isInteger(price.amount) || price.amount <= 0)
      throw new Error('[payments/connect] a recurring price needs a positive amount in minor units')
    if (!INTERVALS.includes(price.interval))
      throw new Error(`[payments/connect] interval must be one of ${INTERVALS.join(', ')}, got ${price.interval}`)
    const intervalCount = price.intervalCount ?? 1
    if (!Number.isInteger(intervalCount) || intervalCount < 1)
      throw new Error(`[payments/connect] intervalCount must be a positive whole number, got ${intervalCount}`)
    if (!price.productName?.trim())
      throw new Error('[payments/connect] a recurring price needs a productName')

    return {
      quantity,
      price_data: {
        currency: price.currency.toLowerCase(),
        unit_amount: price.amount,
        recurring: { interval: price.interval, ...(intervalCount !== 1 ? { interval_count: intervalCount } : {}) },
        product_data: {
          name: price.productName.slice(0, 250),
          ...(price.productDescription ? { description: price.productDescription.slice(0, 500) } : {}),
        },
      },
    }
  }

  /**
   * A Checkout Session in subscription mode that bills the buyer on the
   * platform and settles every paid invoice to the merchant. Send the buyer to
   * `session.url`; the subscription exists once `checkout.session.completed`
   * arrives (its `subscription` field), and carries `metadata` for attribution.
   */
  async function checkout(user: UserModel, options: DestinationSubscriptionCheckoutOptions): Promise<Stripe.Response<Stripe.Checkout.Session>> {
    // Resolved through createOrGetStripeUser rather than read off stripe_id,
    // so a customer deleted in Stripe is replaced instead of failing Checkout.
    const customer = options.customer ?? (await manageCustomer.createOrGetStripeUser(user, {})).id

    return await manageCheckout.create(user, {
      mode: 'subscription',
      customer,
      line_items: [lineItem(options.price, options.quantity)],
      subscription_data: subscriptionData(options.destination, options),
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
      ...(options.clientReferenceId ? { client_reference_id: options.clientReferenceId } : {}),
      ...(options.metadata ? { metadata: options.metadata } : {}),
      ...options.sessionParams,
    })
  }

  /**
   * The connected account a subscription settles to, or null for one the
   * platform keeps. Webhook handlers use it to tell a merchant's subscriber
   * from the platform's own SaaS subscription on the same endpoint.
   */
  function destinationOf(subscription: { transfer_data?: { destination?: string | { id?: string } | null } | null }): string | null {
    const destination = subscription.transfer_data?.destination
    if (!destination) return null
    const id = typeof destination === 'string' ? destination : destination.id
    return id || null
  }

  return { feePercentFor, subscriptionData, lineItem, checkout, destinationOf }
})()
