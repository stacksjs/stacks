import type Stripe from 'stripe'
import type { UserModel } from '../../../../orm/src/models/User'
import { log } from '@stacksjs/logging'
import { stripe } from '..'

export interface ManageCharge {
  createPayment: (user: UserModel, amount: number, options: Stripe.PaymentIntentCreateParams) => Promise<Stripe.Response<Stripe.PaymentIntent>>
  findPayment: (id: string) => Promise<Stripe.PaymentIntent | null>
  refund: (paymentIntentId: string, options?: Stripe.RefundCreateParams) => Promise<Stripe.Response<Stripe.Refund>>
  charge: (user: UserModel, amount: number, paymentMethod: string, options: Stripe.PaymentIntentCreateParams) => Promise<Stripe.Response<Stripe.PaymentIntent>>
}

export const manageCharge: ManageCharge = (() => {
  async function createPayment(user: UserModel, amount: number, options: Stripe.PaymentIntentCreateParams): Promise<Stripe.Response<Stripe.PaymentIntent>> {
    const defaultOptions: Stripe.PaymentIntentCreateParams = {
      // TODO: This should be fetched from the config.
      currency: 'usd',
      amount,
    }

    if (user.hasStripeId()) {
      defaultOptions.customer = user.stripe_id
    }

    const mergedOptions = { ...defaultOptions, ...options }

    return await stripe.paymentIntent.create(mergedOptions)
  }

  async function findPayment(id: string): Promise<Stripe.PaymentIntent | null> {
    try {
      const stripePaymentIntent = await stripe.paymentIntent.retrieve(id)
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

    try {
      return await stripe.refund.create(refundParams)
    }
    catch (error) {
      log.error('Error creating refund:', error)
      throw error
    }
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
