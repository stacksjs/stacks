
import type { UserModel } from '@stacksjs/orm'
import type Stripe from 'stripe'
import { config } from '@stacksjs/config'
import { log } from '@stacksjs/logging'
import { stripe } from '..'

function defaultCurrency(): string {
  // Source order: config.payment.currency → STRIPE_CURRENCY env → 'usd'.
  // Hard-coding USD silently broke EU/GB merchants who shipped a config
  // setting that the framework never read.
  const cfg = (config as { payment?: { currency?: string }, billing?: { currency?: string } }) || {}
  const fromConfig = cfg.payment?.currency || cfg.billing?.currency
  return (fromConfig || process.env.STRIPE_CURRENCY || 'usd').toLowerCase()
}

export interface ManageCharge {
  createPayment: (user: UserModel, amount: number, options: Stripe.PaymentIntentCreateParams) => Promise<Stripe.Response<Stripe.PaymentIntent>>
  findPayment: (id: string) => Promise<Stripe.PaymentIntent | null>
  refund: (paymentIntentId: string, options?: Stripe.RefundCreateParams) => Promise<Stripe.Response<Stripe.Refund>>
  charge: (user: UserModel, amount: number, paymentMethod: string, options: Stripe.PaymentIntentCreateParams) => Promise<Stripe.Response<Stripe.PaymentIntent>>
}

export const manageCharge: ManageCharge = (() => {
  async function createPayment(user: UserModel, amount: number, options: Stripe.PaymentIntentCreateParams): Promise<Stripe.Response<Stripe.PaymentIntent>> {
    const defaultOptions: Stripe.PaymentIntentCreateParams = {
      currency: defaultCurrency(),
      amount,
    }

    if (user.hasStripeId()) {
      defaultOptions.customer = user.stripe_id
    }

    const mergedOptions = { ...defaultOptions, ...options }

    return await stripe.paymentIntents.create(mergedOptions)
  }

  async function findPayment(id: string): Promise<Stripe.PaymentIntent | null> {
    try {
      const stripePaymentIntent = await stripe.paymentIntents.retrieve(id)
      return stripePaymentIntent
    }
    catch (error) {
      log.error(error)

      return null
    }
  }

  async function refund(
    paymentIntentId: string,
    options: Stripe.RefundCreateParams & { idempotencyKey?: string } = {},
  ): Promise<Stripe.Response<Stripe.Refund>> {
    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      throw new Error('[payments/refund] paymentIntentId is required')
    }

    // Validate refund amount against the original charge if specified.
    // Stripe will reject `amount > charged` with a 400, but the error
    // message is generic ("Refund amount cannot exceed amount captured")
    // and doesn't tell the caller what the actual limit was.
    if (options.amount != null) {
      if (typeof options.amount !== 'number' || !Number.isFinite(options.amount) || options.amount <= 0) {
        throw new Error('[payments/refund] amount must be a positive finite number')
      }
      try {
        const original = await stripe.paymentIntents.retrieve(paymentIntentId)
        const captured = original.amount_received ?? original.amount
        if (captured && options.amount > captured) {
          throw new Error(`[payments/refund] amount ${options.amount} exceeds captured amount ${captured}`)
        }
      }
      catch (err: unknown) {
        // Re-throw our own validation error; pass through unknown errors so
        // the original exception (network / Stripe outage) reaches the caller.
        if (err instanceof Error && err.message.startsWith('[payments/refund]')) throw err
      }
    }

    const { idempotencyKey, ...rest } = options
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      ...rest,
    }

    // Idempotency keys protect against double-refunds when a webhook
    // retries or the caller's request times out and gets re-tried.
    // Default to a deterministic key derived from the payment intent +
    // amount so the same logical refund collapses; callers can override
    // to control the dedup window themselves.
    const requestOptions = {
      idempotencyKey: idempotencyKey || `refund:${paymentIntentId}:${rest.amount ?? 'full'}`,
    }

    return await stripe.refunds.create(refundParams, requestOptions)
  }

  async function charge(user: UserModel, amount: number, paymentMethod: string, options: Stripe.PaymentIntentCreateParams): Promise<Stripe.Response<Stripe.PaymentIntent>> {
    const defaultOptions: Stripe.PaymentIntentCreateParams = {
      confirmation_method: 'automatic',
      confirm: true,
      payment_method: paymentMethod,
      currency: defaultCurrency(),
      amount,
    }

    const mergedOptions = { ...defaultOptions, ...options }

    const payment = await createPayment(user, amount, mergedOptions)

    return payment
  }

  return { createPayment, charge, findPayment, refund }
})()
