import type Stripe from 'stripe'
import type { SubscriptionModel } from '../../../../orm/src/models/Subscription'
import type { UserModel } from '../../../../orm/src/models/User'

import { stripe } from '..'
import Subscription from '../../../../orm/src/models/Subscription'

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
    const subscription = await stripe.subscription.create(mergedParams)

    await storeSubscription(subscription)

    return subscription
  }

  async function storeSubscription(options: Stripe.Subscription): Promise<SubscriptionModel> {
    const data = {
      user_id: 1,
      type: 'premium',
      stripe_id: options.id,
      stripe_status: options.status,
      stripe_price: options.items.data[0].price.id,
      quantity: options.items.data[0].quantity,
      trial_ends_at: String(options.trial_end),
      last_used_at: String(options.current_period_end),
    }

    const subscriptionModel = await Subscription.create(data)

    return subscriptionModel
  }

  return { create }
})()
