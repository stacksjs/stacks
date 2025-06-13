import type { SubscriptionsTable, UserModel } from '@stacksjs/orm'
import type Stripe from 'stripe'
import { db } from '@stacksjs/database'

import { manageCustomer, managePrice, stripe } from '..'

export interface SubscriptionManager {
  create: (user: UserModel, type: string, lookupKey: string, params: Partial<Stripe.SubscriptionCreateParams>) => Promise<Stripe.Response<Stripe.Subscription>>
  update: (user: UserModel, type: string, lookupKey: string, params: Partial<Stripe.SubscriptionUpdateParams>) => Promise<Stripe.Response<Stripe.Subscription>>
  cancel: (subscriptionId: string, params?: Partial<Stripe.SubscriptionCreateParams>) => Promise<Stripe.Response<Stripe.Subscription>>
  retrieve: (user: UserModel, subscriptionId: string) => Promise<Stripe.Response<Stripe.Subscription>>
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

    const subscription = await stripe.subscriptions.create(mergedParams)

    await storeSubscription(user, type, lookupKey, subscription)

    return subscription
  }

  async function update(
    user: UserModel,
    type: string,
    lookupKey: string,
  ): Promise<Stripe.Response<Stripe.Subscription>> {
    const newPrice = await managePrice.retrieveByLookupKey(lookupKey)

    const activeSubscription = await user?.activeSubscription()

    if (!newPrice)
      throw new Error('New price does not exist in Stripe')

    if (!activeSubscription)
      throw new Error('No active subscription for user!')

    const subscriptionId = activeSubscription.subscription?.provider_id || ''

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)

    if (!subscription) {
      throw new Error('Subscription does not exist in Stripe')
    }

    const subscriptionItemId = subscription.items.data[0]?.id

    if (!subscriptionItemId) {
      throw new Error('No subscription items found in the subscription')
    }

    await stripe.subscriptionItems.update(subscriptionItemId, {
      price: newPrice.id,
      quantity: 1,
    })

    const updatedSubscription = await stripe.subscriptions.retrieve(subscriptionId)

    await updateSubscription(activeSubscription.subscription?.id, type, updatedSubscription)

    return updatedSubscription
  }

  async function cancel(
    subscriptionId: string,
    params?: Partial<Stripe.SubscriptionCancelParams>,
  ): Promise<Stripe.Response<Stripe.Subscription>> {
    const subscription = await stripe.subscriptions.retrieve(subscriptionId)

    if (!subscription) {
      throw new Error('Subscription does not exist or does not belong to the user')
    }

    const updatedSubscription = await stripe.subscriptions.cancel(subscriptionId, params)

    await updateStoredSubscription(subscriptionId)

    return updatedSubscription
  }

  async function retrieve(user: UserModel, subscriptionId: string): Promise<Stripe.Response<Stripe.Subscription>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const subscription = await stripe.subscriptions.retrieve(subscriptionId)

    return subscription
  }

  async function updateStoredSubscription(subscriptionId: string): Promise<void> {
    await db.updateTable('subscriptions').set({ provider_status: 'canceled' }).where('provider_id', '=', subscriptionId).executeTakeFirst()
  }

  async function isActive(subscription: SubscriptionsTable): Promise<boolean> {
    return subscription.provider_status === 'active'
  }

  async function isTrial(subscription: SubscriptionsTable): Promise<boolean> {
    return subscription.provider_status === 'trialing'
  }

  async function isIncomplete(user: UserModel, type: string): Promise<boolean> {
    const subscription = await db.selectFrom('subscriptions').where('type', '=', type).selectAll().executeTakeFirst()

    if (!subscription)
      return false

    return subscription.provider_status === 'incomplete'
  }

  async function isValid(user: UserModel, type: string): Promise<boolean> {
    const subscription = await db.selectFrom('subscriptions').where('user_id', '=', user.id).where('type', '=', type).selectAll().executeTakeFirst()

    if (!subscription)
      return false

    const active = await isActive(subscription)
    const trial = await isTrial(subscription)

    return active || trial
  }

  async function storeSubscription(user: UserModel, type: string, lookupKey: string, options: Stripe.Subscription): Promise<SubscriptionsTable | undefined> {
    const data = removeNullValues({
      user_id: user.id,
      type,
      unit_price: Number(options.items.data[0].price.unit_amount),
      provider_id: options.id,
      provider_status: options.status,
      provider_price_id: options.items.data[0].price.id,
      quantity: options.items.data[0].quantity,
      trial_ends_at: options.trial_end != null ? String(options.trial_end) : undefined,
      ends_at: options.current_period_end != null ? String(options.current_period_end) : undefined,
      provider_type: 'stripe',
      last_used_at: options.current_period_end != null ? String(options.current_period_end) : undefined,
    })

    const subscriptionModelCreated = await db.insertInto('subscriptions').values(data).executeTakeFirst()
    const subscriptionModel = await db.selectFrom('subscriptions').where('id', '=', Number(subscriptionModelCreated.insertId)).selectAll().executeTakeFirst()

    return subscriptionModel
  }

  async function updateSubscription(activeSubId: number, type: string, options: Stripe.Subscription): Promise<SubscriptionsTable | undefined> {
    const subscription = await db.selectFrom('subscriptions').where('id', '=', activeSubId).selectAll().executeTakeFirst()

    await db?.updateTable('subscriptions')
      .set({
        type,
        provider_price_id: options.items.data[0].price.id,
        unit_price: Number(options.items.data[0].price.unit_amount),
      })
      .where('id', '=', activeSubId)
      .executeTakeFirst()

    return subscription
  }

  function removeNullValues<T extends Record<string, any>>(obj: T): Partial<T> {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, value]) => value != null), // Filters out both `null` and `undefined`
    ) as Partial<T>
  }

  return { create, update, isValid, isIncomplete, cancel, retrieve }
})()
