import type Stripe from 'stripe'
import type { SubscriptionModel } from '../../../../orm/src/models/Subscription'
import type { UserModel } from '../../../../orm/src/models/User'

import { manageCustomer, managePrice, stripe } from '..'
import Subscription from '../../../../orm/src/models/Subscription'

export interface SubscriptionManager {
  create: (user: UserModel, type: string, lookupKey: string, params: Partial<Stripe.SubscriptionCreateParams>) => Promise<Stripe.Response<Stripe.Subscription>>
  isValid: (user: UserModel, type: string) => Promise<boolean>
  isIncomplete: (user: UserModel, type: string) => Promise<boolean>
}

export const manageSubscription: SubscriptionManager = (() => {
  async function create(
    user: UserModel,
    type: string,
    lookupKey: string,
    params: Partial<Stripe.SubscriptionCreateParams>,
  ): Promise<Stripe.Response<Stripe.Subscription>> {
    const price = await managePrice.retrieveByLookupKey(lookupKey)

    if (!price) {
      throw new Error('Price does not exist in Stripe')
    }

    const subscriptionItems = [
      {
        price: price.id,
        quantity: 1,
      },
    ]

    const customerId = await manageCustomer.createOrGetStripeUser(user, {}).then((customer) => {
      if (!customer || !customer.id) {
        throw new Error('Customer does not exist in Stripe')
      }
      return customer.id
    })

    const defaultParams: Stripe.SubscriptionCreateParams = {
      customer: customerId,
      payment_behavior: 'allow_incomplete', // or omit this line entirely
      expand: ['latest_invoice.payment_intent'],
      items: subscriptionItems,
    }

    const mergedParams = { ...defaultParams, ...params }

    const subscription = await stripe.subscription.create(mergedParams)

    await storeSubscription(user, type, subscription)

    return subscription
  }

  async function isActive(subscription: SubscriptionModel): Promise<boolean> {
    return subscription.provider_status === 'active'
  }

  async function isTrial(subscription: SubscriptionModel): Promise<boolean> {
    return subscription.provider_status === 'trialing'
  }

  async function isIncomplete(user: UserModel, type: string): Promise<boolean> {
    const subscription = await Subscription.where('user_id', user.id)
      .where('type', type)
      .first()

    if (!subscription)
      return false

    return subscription.provider_status === 'incomplete'
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
      description: options.description,
      provider_id: options.id,
      provider_status: options.status,
      provider_price_id: options.items.data[0].price.id,
      quantity: options.items.data[0].quantity,
      trial_ends_at: options.trial_end != null ? String(options.trial_end) : undefined,
      ends_at: options.current_period_end != null ? String(options.current_period_end) : undefined,
      provider_type: 'stripe',
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
