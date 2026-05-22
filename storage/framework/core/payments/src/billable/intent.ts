
import type { UserModel } from '@stacksjs/orm'
import type Stripe from 'stripe'
import { manageCustomer, stripe } from '..'
import { freshIdempotencyKey } from '../idempotency'

export interface SetupIntent {
  create: (user: UserModel, params: Stripe.SetupIntentCreateParams) => Promise<Stripe.Response<Stripe.SetupIntent>>
}

export const manageSetupIntent: SetupIntent = (() => {
  async function create(user: UserModel, params: Stripe.SetupIntentCreateParams): Promise<Stripe.Response<Stripe.SetupIntent>> {
    const customerId = await manageCustomer.createOrGetStripeUser(user, {}).then((customer) => {
      if (!customer || !customer.id) {
        throw new Error('Customer does not exist in Stripe')
      }
      return customer.id
    })

    const defaultParams: Partial<Stripe.SetupIntentCreateParams> = {
      customer: customerId,
      payment_method_types: ['card'],
    }

    const mergedParams = { ...defaultParams, ...params }

    // Fresh key per attempt — setup intents are one-shot but a single
    // network retry still benefits from in-flight idempotency on
    // Stripe's side (stacksjs/stacks#1876 X-1).
    return await stripe.setupIntents.create(mergedParams, {
      idempotencyKey: freshIdempotencyKey('setup_intent.create', user.id),
    })
  }

  return { create }
})()
