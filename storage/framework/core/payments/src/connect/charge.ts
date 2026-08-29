import type { UserModel } from '@stacksjs/orm'
import type Stripe from 'stripe'
import { config } from '@stacksjs/config'
import { stripe } from '../drivers/stripe'
import { freshIdempotencyKey } from '../idempotency'
import { requireAccountId } from './account'

function defaultCurrency(): string {
  const cfg = (config as { payment?: { currency?: string }, billing?: { currency?: string } }) || {}
  const fromConfig = cfg.payment?.currency || cfg.billing?.currency
  return (fromConfig || process.env.STRIPE_CURRENCY || 'usd').toLowerCase()
}

function configuredFeePercent(): number | undefined {
  const cfg = (config as { payment?: { connect?: { platformFeePercent?: number } } }) || {}
  return cfg.payment?.connect?.platformFeePercent
}

export interface DestinationChargeOptions extends Partial<Stripe.PaymentIntentCreateParams> {
  /**
   * The platform's cut, in the same minor units as `amount`. Wins over
   * `platformFeePercent` when both are given, because a marketplace that has
   * computed an exact fee (tiered pricing, a promotion, a capped fee) means it.
   */
  applicationFeeAmount?: number

  /**
   * The platform's cut as a percentage of `amount`. Falls back to
   * `config.payment.connect.platformFeePercent`.
   */
  platformFeePercent?: number

  /** Ties several charges and transfers together for later reporting. */
  transferGroup?: string
}

export interface ManageDestinationCharge {
  destinationCharge: (
    user: UserModel,
    amount: number,
    destinationAccountId: string,
    options?: DestinationChargeOptions,
  ) => Promise<Stripe.Response<Stripe.PaymentIntent>>
  applicationFeeFor: (amount: number, options?: { applicationFeeAmount?: number, platformFeePercent?: number }) => number | undefined
}

export const manageDestinationCharge: ManageDestinationCharge = (() => {
  /**
   * The platform's cut for a charge, in minor units.
   *
   * Rounded down, deliberately: rounding a percentage up can produce a fee that
   * exceeds the charge on tiny amounts, and Stripe rejects the whole payment
   * intent when it does. Undefined means "take nothing", which is a legitimate
   * configuration for a platform that monetises elsewhere.
   */
  function applicationFeeFor(
    amount: number,
    options: { applicationFeeAmount?: number, platformFeePercent?: number } = {},
  ): number | undefined {
    if (options.applicationFeeAmount != null) {
      if (!Number.isFinite(options.applicationFeeAmount) || options.applicationFeeAmount < 0)
        throw new Error('[payments/connect] applicationFeeAmount must be a non-negative number of minor units')

      if (options.applicationFeeAmount > amount)
        throw new Error(`[payments/connect] applicationFeeAmount ${options.applicationFeeAmount} exceeds the charge amount ${amount}`)

      return Math.floor(options.applicationFeeAmount)
    }

    const percent = options.platformFeePercent ?? configuredFeePercent()
    if (percent == null) return undefined

    if (!Number.isFinite(percent) || percent < 0 || percent > 100)
      throw new Error(`[payments/connect] platformFeePercent must be between 0 and 100, got ${percent}`)

    return Math.floor((amount * percent) / 100)
  }

  /**
   * Charge a customer on the platform and settle the balance to a merchant.
   *
   * The money lands on the platform account, the platform keeps
   * `application_fee_amount`, and Stripe transfers the rest to the connected
   * account. This is the shape a food-delivery or storefront marketplace wants:
   * one card charge the customer recognises, refunds and disputes owned by the
   * platform, and the merchant paid out on their own schedule.
   */
  async function destinationCharge(
    user: UserModel,
    amount: number,
    destinationAccountId: string,
    options: DestinationChargeOptions = {},
  ): Promise<Stripe.Response<Stripe.PaymentIntent>> {
    requireAccountId(destinationAccountId, 'destinationCharge')

    if (!Number.isFinite(amount) || amount <= 0)
      throw new Error('[payments/connect] destinationCharge requires a positive amount in minor units')

    const {
      applicationFeeAmount,
      platformFeePercent,
      transferGroup,
      ...intentParams
    } = options

    const fee = applicationFeeFor(amount, { applicationFeeAmount, platformFeePercent })

    const params: Stripe.PaymentIntentCreateParams = {
      amount,
      currency: defaultCurrency(),
      transfer_data: { destination: destinationAccountId },
      ...(fee != null && fee > 0 ? { application_fee_amount: fee } : {}),
      ...(transferGroup ? { transfer_group: transferGroup } : {}),
      ...intentParams,
    }

    if (!params.customer && user.hasStripeId())
      params.customer = user.stripe_id ?? undefined

    // Fresh per attempt, matching `manageCharge.createPayment`: each call is a
    // new order, and collapsing two genuine orders from one customer onto a
    // cached intent would lose a sale. The key still covers a network retry
    // inside a single attempt.
    return await stripe.paymentIntents.create(params, {
      idempotencyKey: freshIdempotencyKey('connect.destination_charge', user.id, amount),
    })
  }

  return { destinationCharge, applicationFeeFor }
})()
