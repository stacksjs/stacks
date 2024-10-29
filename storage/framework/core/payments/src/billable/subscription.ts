import type Stripe from 'stripe'
import type { UserModel } from '../../../../orm/src/models/User'
import { stripe } from '..'

export interface SubscriptionManager {
  create: (user: UserModel, params: Stripe.SubscriptionCreateParams) => Promise<Stripe.Response<Stripe.Subscription>>
}

export const manageSubscription: SubscriptionManager = (() => {
  async function create(user: UserModel, params: Stripe.SubscriptionCreateParams): Promise<Stripe.Response<Stripe.Subscription>> {
    // Check if the user has a Stripe customer ID
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    // Define default parameters
    const defaultParams: Partial<Stripe.SubscriptionCreateParams> = {
      customer: user.stripeId(),
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    }

    // Merge provided params with defaultParams
    const mergedParams = { ...defaultParams, ...params }

    // Create and return the subscription
    return await stripe.subscription.create(mergedParams)
  }

  return { create }
})()
