
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

  async function refund(paymentIntentId: string, options: Stripe.RefundCreateParams = {}): Promise<Stripe.Response<Stripe.Refund>> {
    const refundParams: Stripe.RefundCreateParams = {
      payment_intent: paymentIntentId,
      ...options,
    }

    return await stripe.refunds.create(refundParams)
  }

  async function charge(user: UserModel, amount: number, paymentMethod: string, options: Stripe.PaymentIntentCreateParams): Promise<Stripe.Response<Stripe.PaymentIntent>> {
    const defaultOptions: Stripe.PaymentIntentCreateParams = {
      confirmation_method: 'automatic',
      confirm: true,
      payment_method: paymentMethod,
      currency: 'usd',
      amount,
    }

    const mergedOptions = { ...defaultOptions, ...options }

    const payment = await createPayment(user, amount, mergedOptions)

    return payment
  }

  return { createPayment, charge, findPayment, refund }
})()
