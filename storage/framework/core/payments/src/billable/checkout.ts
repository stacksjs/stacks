import type Stripe from 'stripe'
import type { UserModel } from '../../../../orm/src/models/User'
import { env } from '@stacksjs/env'
import { stripe } from '..'


export interface Checkout {
  create: (user: UserModel, params: Stripe.Checkout.SessionCreateParams) => Promise<Stripe.Response<Stripe.Checkout.Session>>
}

export const manageCheckout: Checkout = (() => {
  async function create(user: UserModel, params: Stripe.Checkout.SessionCreateParams): Promise<Stripe.Response<Stripe.Checkout.Session>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const defaultParams: Partial<Stripe.Checkout.SessionCreateParams> = {
      customer: user.stripeId(),
      mode: 'payment',
      success_url: params.success_url,
      cancel_url: params.cancel_url,
    }

    const mergedParams = { ...defaultParams, ...params }

    return await stripe.checkout.create(mergedParams)
  }

  return { create }
})()
