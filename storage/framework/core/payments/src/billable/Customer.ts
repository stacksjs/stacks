import type { UserModel } from '../../../../orm/src/models/User'
import { stripe } from '..'

export const paymentIntent: any = (() => {
  function stripeId(user: any): string {
    return user.stripe_id
  }

  function hasStripeId(user: any): boolean {
    return user.stripe_id !== null || user.stripe_id !== undefined
  }

  function createStripeCustomer(user: any, options: any = {}): Promise<any> {
    if (hasStripeId(user)) {
      throw new Error('Customer already created')
    }

    if (!options.name && user.stripeName) {
      options.name = stripeName(user)
    }

    if (!options.email && user.stripeEmail) {
      options.email = stripeEmail(user)
    }

    if (!options.phone && user.stripePhone) {
      options.phone = stripePhone(user)
    }

    if (!options.address && user.stripeAddress) {
      options.address = stripeAddress(user)
    }

    if (!options.preferred_locales && user.stripePreferredLocales) {
      options.preferred_locales = stripePreferredLocales(user)
    }

    if (!options.metadata && user.stripeMetadata) {
      options.metadata = stripeMetadata(user)
    }

    // Here we will create the customer instance on Stripe and store the ID of the
    // user from Stripe. This ID will correspond with the Stripe user instances
    // and allow us to retrieve users from Stripe later when we need to work.
    return stripe.customer.create(options).then((customer: any) => {
      return user.update({ stripe_id: customer.id })
    })
  }

  function stripeName(user: any): string {
    return user.name || ''
  }

  function stripeEmail(user: any): string {
    return user.email || ''
  }

  function stripePhone(user: any): string {
    return user.phone || ''
  }

  function stripeAddress(user: any): string {
    return user.address || null
  }

  function stripePreferredLocales(user: any): string {
    return user.preferred_locales || []
  }

  function stripeMetadata(user: any): string {
    return user.metadata || {}
  }

  return { stripeId, hasStripeId, createStripeCustomer }
})()
