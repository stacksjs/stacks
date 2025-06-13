import type { UserModel } from '@stacksjs/orm'
import type Stripe from 'stripe'
import { stripe } from '..'

export interface ManageInvoice {
  list: (user: UserModel) => Promise<Stripe.Response<Stripe.ApiList<Stripe.Invoice>>>
}

export const manageInvoice: ManageInvoice = (() => {
  async function list(user: UserModel): Promise<Stripe.Response<Stripe.ApiList<Stripe.Invoice>>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const invoices = await stripe.invoices.list({
      customer: user?.stripeId(),
      expand: ['data.payment_intent.payment_method'],
    })

    return invoices
  }

  return { list }
})()
