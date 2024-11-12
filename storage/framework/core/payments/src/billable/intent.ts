import type Stripe from 'stripe'
import type { UserModel } from '../../../../orm/src/models/User'
import { stripe } from '..'

export interface SetupIntent {
  create: (user: UserModel, params: Stripe.SetupIntentCreateParams) => Promise<Stripe.Response<Stripe.SetupIntent>>
}

export const manageSetupIntent: SetupIntent = (() => {
  async function create(user: UserModel, params: Stripe.SetupIntentCreateParams): Promise<Stripe.Response<Stripe.SetupIntent>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const defaultParams: Partial<Stripe.SetupIntentCreateParams> = {
      customer: user.stripeId(),
      payment_method_types: ['card'],
    }

    const mergedParams = { ...defaultParams, ...params }

    return await stripe.setupIntents.create(mergedParams)
  }

  return { create }
})()
