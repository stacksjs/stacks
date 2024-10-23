import type Stripe from 'stripe'
import type { UserModel } from '../../../../orm/src/models/User'
import { stripe } from '..'

export const paymentIntent: any = (() => {
  function stripeId(user: UserModel): string {
    return user.stripe_id
  }

  function hasStripeId(user: UserModel): boolean {
    return user.stripe_id !== null || user.stripe_id !== undefined
  }

  function createStripeCustomer(user: UserModel, options: any = {}): Promise<Stripe.Response<Stripe.Customer>> {
    if (hasStripeId(user)) {
      throw new Error('Customer already created')
    }

    if (!options.name && stripeName(user)) {
      options.name = stripeName(user)
    }

    if (!options.email && stripeEmail(user)) {
      options.email = stripeEmail(user)
    }

    if (!options.preferred_locales && stripePreferredLocales) {
      options.preferred_locales = stripePreferredLocales(user)
    }

    if (!options.metadata && stripeMetadata(user)) {
      options.metadata = stripeMetadata(user)
    }

    // Here we will create the customer instance on Stripe and store the ID of the
    // user from Stripe. This ID will correspond with the Stripe user instances
    // and allow us to retrieve users from Stripe later when we need to work.
    return stripe.customer.create(options).then((customer: any) => {
      return user.update({ stripe_id: customer.id })
    })
  }

  function stripeName(user: UserModel): string {
    return user.name || ''
  }

  function stripeEmail(user: UserModel): string {
    return user.email || ''
  }

  function stripePreferredLocales(user: any): string {
    return user.preferred_locales || []
  }

  function stripeMetadata(user: any): string {
    return user.metadata || {}
  }

  return { stripeId, hasStripeId, createStripeCustomer }
})()
