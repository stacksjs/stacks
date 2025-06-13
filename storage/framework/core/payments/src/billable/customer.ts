import type { UserModel } from '@stacksjs/orm'
import type { StripeCustomerOptions } from '@stacksjs/types'
import type Stripe from 'stripe'
import { stripe } from '..'

export interface ManageCustomer {
  stripeId: (user: UserModel) => string
  hasStripeId: (user: UserModel) => boolean
  createStripeCustomer: (user: UserModel, options: Stripe.CustomerCreateParams) => Promise<Stripe.Response<Stripe.Customer>>
  updateStripeCustomer: (user: UserModel, options: Stripe.CustomerCreateParams) => Promise<Stripe.Response<Stripe.Customer>>
  createOrGetStripeUser: (user: UserModel, options: Stripe.CustomerCreateParams) => Promise<Stripe.Response<Stripe.Customer>>
  retrieveStripeUser: (user: UserModel) => Promise<Stripe.Response<Stripe.Customer> | undefined>
  createOrUpdateStripeUser: (user: UserModel, options: Stripe.CustomerCreateParams) => Promise<Stripe.Response<Stripe.Customer>>
  deleteStripeUser: (user: UserModel) => Promise<Stripe.Response<Stripe.DeletedCustomer>>
  syncStripeCustomerDetails: (user: UserModel, options: StripeCustomerOptions) => Promise<Stripe.Response<Stripe.Customer>>
}

export const manageCustomer: ManageCustomer = (() => {
  function stripeId(user: UserModel): string {
    return user.stripe_id || ''
  }

  function stripeAddress(options: StripeCustomerOptions): {
    line1?: string
    city?: string
    state?: string
    postal_code?: string
    country?: string
  } {
    return {
      line1: options.address?.line1,
      city: options.address?.city,
      state: options.address?.state,
      postal_code: options.address?.postal_code,
      country: options.address?.country,
    }
  }

  function stripePreferredLocales(): string[] {
    return []
  }

  function stripeMetadata(metadata: Stripe.Emptyable<Stripe.MetadataParam>): Stripe.Emptyable<Stripe.MetadataParam> {
    return metadata
  }

  function hasStripeId(user: UserModel): boolean {
    return Boolean(user.stripe_id)
  }

  async function createStripeCustomer(user: UserModel, options: Stripe.CustomerCreateParams = {}): Promise<Stripe.Response<Stripe.Customer>> {
    if (hasStripeId(user)) {
      throw new Error('Customer already created')
    }

    if (!options.name && stripeName(user)) {
      options.name = stripeName(user)
    }

    if (!options.email && stripeEmail(user)) {
      options.email = stripeEmail(user)
    }

    const customer = await stripe.customers.create(options)

    await user.update({ stripe_id: customer.id })

    return customer
  }

  async function updateStripeCustomer(user: UserModel, options: Stripe.CustomerCreateParams = {}): Promise<Stripe.Response<Stripe.Customer>> {
    const customer = await stripe.customers.update(user.stripe_id || '', options)

    return customer
  }

  async function deleteStripeUser(user: UserModel): Promise<Stripe.Response<Stripe.DeletedCustomer>> {
    if (!hasStripeId(user)) {
      throw new Error('User does not have a Stripe ID')
    }

    try {
      const deletedCustomer = await stripe.customers.del(user.stripe_id || '')

      // Update the user model to remove the Stripe ID
      await user.update({ stripe_id: '' })

      return deletedCustomer
    }
    catch (error) {
      if ((error as any).statusCode === 404) {
        throw new Error('Customer not found in Stripe')
      }
      throw error
    }
  }

  async function createOrGetStripeUser(user: UserModel, options: Stripe.CustomerCreateParams = {}): Promise<Stripe.Response<Stripe.Customer>> {
    if (!hasStripeId(user)) {
      return await createStripeCustomer(user, options)
    }

    try {
      const customer = await stripe.customers.retrieve(user.stripe_id || '')
      if ((customer as Stripe.DeletedCustomer).deleted) {
        throw new Error('Customer was deleted')
      }

      return customer as Stripe.Response<Stripe.Customer>
    }
    catch (error) {
      if ((error as any).statusCode === 404) {
        return await createStripeCustomer(user, options)
      }
      throw error
    }
  }

  async function retrieveStripeUser(user: UserModel): Promise<Stripe.Response<Stripe.Customer> | undefined> {
    if (!hasStripeId(user)) {
      return undefined
    }

    try {
      const customer = await stripe.customers.retrieve(user.stripe_id || '')

      if ((customer as Stripe.DeletedCustomer).deleted) {
        throw new Error('Customer was deleted in Stripe')
      }

      return customer as Stripe.Response<Stripe.Customer>
    }
    catch (error) {
      if ((error as any).statusCode === 404) {
        throw new Error('Customer not found in Stripe')
      }
      throw error
    }
  }

  async function createOrUpdateStripeUser(user: UserModel, options: Stripe.CustomerCreateParams): Promise<Stripe.Response<Stripe.Customer>> {
    if (!hasStripeId(user)) {
      return await createStripeCustomer(user, options)
    }

    try {
      const customer = await stripe.customers.retrieve(user.stripe_id || '')
      if ((customer as Stripe.DeletedCustomer).deleted) {
        return await createStripeCustomer(user, options)
      }

      return await updateStripeCustomer(user, options)
    }
    catch (error) {
      if ((error as any).statusCode === 404) {
        return await createStripeCustomer(user, options)
      }

      throw error
    }
  }

  async function syncStripeCustomerDetails(user: UserModel, options: StripeCustomerOptions): Promise<Stripe.Response<Stripe.Customer>> {
    return await updateStripeCustomer(user, {
      name: stripeName(user),
      email: stripeEmail(user),
      address: stripeAddress(options),
      preferred_locales: stripePreferredLocales(),
      metadata: options.metadata ? stripeMetadata(options.metadata) : {},
    })
  }

  function stripeName(user: UserModel): string {
    return user.name || ''
  }

  function stripeEmail(user: UserModel): string {
    return user.email || ''
  }

  return { stripeId, hasStripeId, createStripeCustomer, updateStripeCustomer, createOrGetStripeUser, createOrUpdateStripeUser, deleteStripeUser, retrieveStripeUser, syncStripeCustomerDetails }
})()
