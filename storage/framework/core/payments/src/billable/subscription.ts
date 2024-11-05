import type Stripe from 'stripe'
import type { SubscriptionModel } from '../../../../orm/src/models/Subscription'
import type { UserModel } from '../../../../orm/src/models/User'

import { stripe } from '..'
import Subscription from '../../../../orm/src/models/Subscription'

export interface SubscriptionManager {
  create: (user: UserModel, type: string, params: Stripe.SubscriptionCreateParams) => Promise<Stripe.Response<Stripe.Subscription>>
  isValid: (user: UserModel, type: string) => Promise<boolean>
}

export const manageSubscription: SubscriptionManager = (() => {
  async function create(user: UserModel, type: string, params: Stripe.SubscriptionCreateParams): Promise<Stripe.Response<Stripe.Subscription>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const defaultParams: Partial<Stripe.SubscriptionCreateParams> = {
      customer: user.stripeId(),
      payment_behavior: 'default_incomplete',
      expand: ['latest_invoice.payment_intent'],
    }

    const mergedParams = { ...defaultParams, ...params }

    const subscription = await stripe.subscription.create(mergedParams)

    await storeSubscription(user, type, subscription)

    return subscription
  }

  async function isActive(subscription: SubscriptionModel): Promise<boolean> {
    return subscription.stripe_status === 'active'
  }

  async function isIncomplete(subscription: SubscriptionModel): Promise<boolean> {
    return subscription.stripe_status === 'incomplete'
  }

  async function isTrial(subscription: SubscriptionModel): Promise<boolean> {
    return subscription.stripe_status === 'trialing'
  }

  async function isValid(user: UserModel, type: string): Promise<boolean> {
    const subscription = await Subscription.where('user_id', user.id)
      .where('type', type)
      .first()

    if (!subscription)
      return false

    const active = await isActive(subscription)
    const trial = await isTrial(subscription)

    return active || trial
  }

  async function storeSubscription(user: UserModel, type: string, options: Stripe.Subscription): Promise<SubscriptionModel> {
    const data = removeNullValues({
      user_id: user.id,
      type,
      stripe_id: options.id,
      stripe_status: options.status,
      stripe_price: options.items.data[0].price.id,
      quantity: options.items.data[0].quantity,
      trial_ends_at: options.trial_end != null ? String(options.trial_end) : undefined,
      ends_at: options.current_period_end != null ? String(options.current_period_end) : undefined,
      last_used_at: options.current_period_end != null ? String(options.current_period_end) : undefined,
    })

    const subscriptionModel = await Subscription.create(data)

    return subscriptionModel
  }

  function removeNullValues<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value != null), // Filters out both `null` and `undefined`
    ) as Partial<T>
  }

  return { create, isValid, isIncomplete }
})()
