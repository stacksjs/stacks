
import type { UserModel } from '@stacksjs/orm'
import type Stripe from 'stripe'
import { stripe } from '../drivers/stripe'
import { manageCustomer } from './customer'

export interface ManageInvoice {
  list: (user: UserModel) => Promise<Stripe.Response<Stripe.ApiList<Stripe.Invoice>>>
}

export const manageInvoice: ManageInvoice = (() => {
  async function list(user: UserModel): Promise<Stripe.Response<Stripe.ApiList<Stripe.Invoice>>> {
    if (!manageCustomer.hasStripeId(user)) {
      throw new Error('Customer does not exist in Stripe')
    }

    if (!user.stripe_id) {
      throw new Error('User has no Stripe ID')
    }

    const invoices = await stripe.invoices.list({
      customer: user.stripe_id,
      expand: ['data.payment_intent.payment_method'],
    })

    return invoices
  }

  return { list }
})()
