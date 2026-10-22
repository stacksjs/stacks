import type { UserModel } from '@stacksjs/orm'
import type Stripe from 'stripe'
import type { DestinationOptions } from './destination'
import type { InlineRecurringPrice } from './subscription'
import { stripe } from '../drivers/stripe'
import { assertSameOriginUrl } from '../billable/checkout'
import { freshIdempotencyKey, idempotencyFingerprint, stacksIdempotencyKey } from '../idempotency'
import { requireAccountId } from './account'
import { destinationFeeCents, destinationFeePercent } from './destination'
import { manageDestinationSubscription } from './subscription'

/**
 * Direct charges: the sale is made on the merchant's own connected account,
 * and the platform takes its cut as an application fee.
 *
 * This is the funds flow Stripe's Managed Risk is for (Stripe manages the
 * merchant's credit and fraud risk and carries unrecoverable negative
 * balances), and the one Stripe now requires of a platform that has not taken
 * on loss liability itself: destination charges and separate transfers need
 * the platform to be the losses collector.
 *
 * Everything that belongs to the sale lives on the connected account: the
 * customer, the Checkout Session, the PaymentIntent, the subscription and its
 * invoices, saved payment methods and mandates, and the refund. A call acts as
 * the account with Stripe's `Stripe-Account` header, `asAccount(id)` as the
 * request options. Stripe's processing fees are the merchant's; the platform
 * receives the application fee whole.
 *
 * | Where the money is taken          | Fields                                     | Request options     |
 * |-----------------------------------|--------------------------------------------|---------------------|
 * | Checkout, `mode: 'payment'`       | `payment_intent_data.application_fee_amount` | `asAccount(id)`   |
 * | Checkout, `mode: 'subscription'`  | `subscription_data.application_fee_percent`  | `asAccount(id)`   |
 * | `stripe.subscriptions.create`     | `application_fee_percent`                  | `asAccount(id)`     |
 * | `stripe.paymentIntents.create`    | `application_fee_amount`                   | `asAccount(id)`     |
 */

/** The platform's cut of a direct charge: a percent or an amount, as for destination charges. */
export type DirectFeeOptions = Pick<DestinationOptions, 'feePercent' | 'feeCents' | 'rounding'>

/** The Connect fields of a one-off direct charge. */
export type DirectPaymentFields = Pick<Stripe.PaymentIntentCreateParams, 'application_fee_amount'>

/** The Connect fields of a subscription created directly on the account. */
export type DirectSubscriptionFields = Pick<Stripe.SubscriptionCreateParams, 'application_fee_percent'>

/**
 * Request options that make a Stripe call as the connected account (the
 * `Stripe-Account` header), merged with any others (an idempotency key).
 *
 * @example
 * await stripe.checkout.sessions.retrieve(sessionId, asAccount(gym.stripe_account_id))
 */
export function asAccount(accountId: string, extra: Stripe.RequestOptions = {}): Stripe.RequestOptions {
  requireAccountId(accountId, 'asAccount')
  return { ...extra, stripeAccount: accountId }
}

/** The fields of a PaymentIntent for `amount` minor units charged directly, to spread into its params. */
export function directPaymentIntentParams(amount: number, options: DirectFeeOptions = {}): DirectPaymentFields {
  const fee = destinationFeeCents(amount, options)
  return fee > 0 ? { application_fee_amount: fee } : {}
}

/**
 * `payment_intent_data` for a Checkout Session in `mode: 'payment'`, created
 * on the connected account, whose line items total `amount` minor units.
 * `extra` carries the PaymentIntent's other fields (metadata, a description);
 * any destination fields in it are dropped, since a direct charge has none.
 */
export function directCheckoutPaymentData(
  amount: number,
  options: DirectFeeOptions = {},
  extra: Stripe.Checkout.SessionCreateParams.PaymentIntentData = {},
): Stripe.Checkout.SessionCreateParams.PaymentIntentData {
  const rest = { ...extra }
  delete rest.application_fee_amount
  delete rest.transfer_data
  delete rest.on_behalf_of
  delete rest.transfer_group
  return { ...rest, ...directPaymentIntentParams(amount, options) }
}

/**
 * `subscription_data` for a Checkout Session in `mode: 'subscription'`,
 * created on the connected account: every invoice pays the platform
 * `feePercent`. `extra` carries the subscription's other fields.
 */
export function directCheckoutSubscriptionData(
  options: Pick<DirectFeeOptions, 'feePercent' | 'feeCents'> = {},
  extra: Stripe.Checkout.SessionCreateParams.SubscriptionData = {},
): Stripe.Checkout.SessionCreateParams.SubscriptionData {
  const percent = destinationFeePercent(options)
  const rest = { ...extra }
  delete rest.application_fee_percent
  delete rest.transfer_data
  delete rest.on_behalf_of
  return { ...rest, ...(percent != null ? { application_fee_percent: percent } : {}) }
}

/** The fields of a subscription created directly on the account (`stripe.subscriptions.create`). */
export function directSubscriptionParams(options: Pick<DirectFeeOptions, 'feePercent' | 'feeCents'> = {}): DirectSubscriptionFields {
  const percent = destinationFeePercent(options)
  return percent != null ? { application_fee_percent: percent } : {}
}

/** The Stripe customer calls a connected customer needs. */
type CustomerClient = Pick<Stripe, 'customers'>

/**
 * The idempotency key for creating `user`'s customer on `accountId`: the same
 * for every attempt with the same details, so two requests racing to create
 * one make one, while a changed name or email is a new request rather than a
 * reused key Stripe would refuse.
 */
export function connectedCustomerIdempotencyKey(accountId: string, userId: number | string, params: Stripe.CustomerCreateParams = {}): string {
  return stacksIdempotencyKey('connect.customer.create', userId, accountId, idempotencyFingerprint(params))
}

/**
 * The user's customer on a connected account, created on first use. A
 * customer belongs to one account, so the platform's own customer (the user's
 * `stripe_id`) cannot pay a direct charge; each merchant the user buys from
 * holds its own. Found again by the user's id in the customer's metadata,
 * looked up by email first (immediately consistent) and by metadata search
 * when the email has changed, and created with a deterministic idempotency
 * key, so nothing on the app's side has to remember it.
 */
export async function connectedCustomer(
  user: Pick<UserModel, 'id' | 'email' | 'name'> & { email?: string | null, name?: string | null },
  accountId: string,
  client: CustomerClient = stripe,
): Promise<Stripe.Customer> {
  requireAccountId(accountId, 'connectedCustomer')
  const userId = String(user.id)
  const options = asAccount(accountId)
  const own = (customer: Stripe.Customer | Stripe.DeletedCustomer): customer is Stripe.Customer =>
    !('deleted' in customer && customer.deleted) && (customer as Stripe.Customer).metadata?.stacks_user_id === userId

  if (user.email) {
    const byEmail = await client.customers.list({ email: user.email, limit: 100 }, options)
    const found = byEmail.data.find(own)
    if (found) return found
  }

  try {
    const searched = await client.customers.search({ query: `metadata['stacks_user_id']:'${userId.replace(/'/g, '')}'`, limit: 1 }, options)
    const found = searched.data.find(own)
    if (found) return found
  }
  catch {
    // Search is not offered everywhere; the create below is idempotent anyway.
  }

  const params: Stripe.CustomerCreateParams = {
    ...(user.email ? { email: user.email } : {}),
    ...(user.name ? { name: user.name } : {}),
    metadata: { stacks_user_id: userId },
  }
  return await client.customers.create(params, asAccount(accountId, { idempotencyKey: connectedCustomerIdempotencyKey(accountId, userId, params) }))
}

/**
 * A Checkout Session on the connected account, as `manageCheckout.create`
 * makes one on the platform: the user's customer there unless `params` names
 * one, return URLs held to the app's origin, and a fresh idempotency key so a
 * retried request does not open a second session.
 *
 * @example
 * await directCheckout(user, gym.stripe_account_id, {
 *   mode: 'payment', line_items,
 *   payment_intent_data: directCheckoutPaymentData(checkoutLineItemsTotal(line_items), { feeCents }),
 *   success_url, cancel_url,
 * })
 */
export async function directCheckout(
  user: UserModel,
  accountId: string,
  params: Stripe.Checkout.SessionCreateParams,
  client: Pick<Stripe, 'customers' | 'checkout'> = stripe,
): Promise<Stripe.Response<Stripe.Checkout.Session>> {
  requireAccountId(accountId, 'directCheckout')
  assertSameOriginUrl(params.success_url, 'success_url')
  assertSameOriginUrl(params.cancel_url, 'cancel_url')
  const customer = params.customer ?? (params.customer_email ? undefined : (await connectedCustomer(user as any, accountId, client)).id)
  return await client.checkout.sessions.create({
    mode: 'payment',
    ...params,
    ...(customer ? { customer } : {}),
  }, asAccount(accountId, { idempotencyKey: freshIdempotencyKey('connect.checkout.create', user.id, accountId) }))
}

export interface DirectSubscriptionCheckoutOptions {
  /** The merchant's connected account the subscription is made on. */
  account: string
  /** A catalog price on that account (`price_...`) or an inline recurring price. */
  price: string | InlineRecurringPrice
  quantity?: number
  trialDays?: number
  /** The platform's share of every invoice (`application_fee_percent`), or the configured default. */
  platformFeePercent?: number
  metadata?: Record<string, string>
  clientReferenceId?: string
  /** The customer on the connected account; found or created for the user when omitted. */
  customer?: string
  successUrl: string
  cancelUrl: string
  sessionParams?: Partial<Stripe.Checkout.SessionCreateParams>
}

export interface ManageDirectSubscription {
  subscriptionData: (options?: Pick<DirectSubscriptionCheckoutOptions, 'trialDays' | 'platformFeePercent' | 'metadata'>) => Stripe.Checkout.SessionCreateParams.SubscriptionData
  checkout: (user: UserModel, options: DirectSubscriptionCheckoutOptions, client?: Pick<Stripe, 'customers' | 'checkout'>) => Promise<Stripe.Response<Stripe.Checkout.Session>>
}

/** Subscriptions billed on the merchant's account, the platform paid its fee from each invoice. */
export const manageDirectSubscription: ManageDirectSubscription = (() => {
  function subscriptionData(options: Pick<DirectSubscriptionCheckoutOptions, 'trialDays' | 'platformFeePercent' | 'metadata'> = {}): Stripe.Checkout.SessionCreateParams.SubscriptionData {
    if (options.trialDays != null && (!Number.isInteger(options.trialDays) || options.trialDays < 1 || options.trialDays > 730))
      throw new Error(`[payments/connect] trialDays must be a whole number from 1 to 730, got ${options.trialDays}`)
    const fee = manageDestinationSubscription.feePercentFor({ platformFeePercent: options.platformFeePercent })
    return {
      ...(fee != null ? { application_fee_percent: fee } : {}),
      ...(options.trialDays ? { trial_period_days: options.trialDays } : {}),
      ...(options.metadata ? { metadata: options.metadata } : {}),
    }
  }

  async function checkout(user: UserModel, options: DirectSubscriptionCheckoutOptions, client: Pick<Stripe, 'customers' | 'checkout'> = stripe): Promise<Stripe.Response<Stripe.Checkout.Session>> {
    requireAccountId(options.account, 'manageDirectSubscription.checkout')
    const customer = options.customer ?? (await connectedCustomer(user as any, options.account, client)).id
    return await directCheckout(user, options.account, {
      mode: 'subscription',
      customer,
      line_items: [manageDestinationSubscription.lineItem(options.price, options.quantity)],
      subscription_data: subscriptionData(options),
      success_url: options.successUrl,
      cancel_url: options.cancelUrl,
      ...(options.clientReferenceId ? { client_reference_id: options.clientReferenceId } : {}),
      ...(options.metadata ? { metadata: options.metadata } : {}),
      ...options.sessionParams,
    }, client)
  }

  return { subscriptionData, checkout }
})()
