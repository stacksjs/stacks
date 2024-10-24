import type Stripe from 'stripe'
import type { UserModel } from '../../../../orm/src/models/User'
import { stripe } from '..'

export const paymentIntent: any = (() => {
  function stripeId(user: UserModel): string {
    return user.stripe_id || ''
  }

  function hasStripeId(user: UserModel): boolean {
    return user.stripe_id !== null || user.stripe_id !== undefined
  }

  async function createStripeCustomer(user: UserModel, options: any = {}): Promise<Stripe.Response<Stripe.Customer>> {
    if (hasStripeId(user)) {
      throw new Error('Customer already created')
    }

    if (!options.name && stripeName(user)) {
      options.name = stripeName(user)
    }

    if (!options.email && stripeEmail(user)) {
      options.email = stripeEmail(user)
    }

    const customer = await stripe.customer.create(options)

    user.update({ stripe_id: customer.id })

    return customer
  }

  async function updateStripeCustomer(user: UserModel, options: Stripe.CustomerUpdateParams): Promise<Stripe.Response<Stripe.Customer>> {
    const customer = await stripe.customer.update(user.stripe_id || '', options)

    return customer
  }

  async function createOrGetStripeUser(user: UserModel, options: Stripe.CustomerCreateParams = {}): Promise<Stripe.Response<Stripe.Customer>> {
    if (!hasStripeId(user)) {
      return await createStripeCustomer(user, options)
    }

    try {
      const customer = await stripe.customer.retrieve(user.stripe_id || '')
      if ((customer as Stripe.DeletedCustomer).deleted) {
        throw new Error('Customer was deleted')
      }

      return customer as Stripe.Response<Stripe.Customer>

    } catch (error) {
      if ((error as any).statusCode === 404) {
        return await createStripeCustomer(user, options)
      }
      throw error
    }
  }

  async function createOrUpdateStripeUser(user: UserModel, options: Stripe.CustomerCreateParams | Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
    if (!hasStripeId(user)) {
      return await createStripeCustomer(user, options)
    }

    try {
      const customer = await stripe.customer.retrieve(user.stripe_id || '')
      if ((customer as Stripe.DeletedCustomer).deleted) {
        return await createStripeCustomer(user, options)
      }

      return await updateStripeCustomer(user, options)
    } catch (error) {
      if ((error as any).statusCode === 404) {
        return await createStripeCustomer(user, options)
      }

      throw error
    }
  }

  function stripeName(user: UserModel): string {
    return user.name || ''
  }

  function stripeEmail(user: UserModel): string {
    return user.email || ''
  }

  return { stripeId, hasStripeId, createStripeCustomer, updateStripeCustomer, createOrGetStripeUser, createOrUpdateStripeUser }
})()
