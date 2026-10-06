
import type { UserModel } from '@stacksjs/orm'
import type Stripe from 'stripe'
import { stripe } from '../drivers/stripe'
import { manageCustomer } from './customer'

export interface ManageInvoice {
  list: (user: UserModel) => Promise<Stripe.Response<Stripe.ApiList<Stripe.Invoice>>>
}

/**
 * Invoices are listed with their payments expanded. This expanded
 * `data.payment_intent.payment_method`, but Stripe removed `payment_intent`
 * from the Invoice in API 2025-03-31.basil; an invoice can be paid by several
 * payments now, listed in `payments`. Expanding the old path failed the list.
 */
export const INVOICE_LIST_EXPAND = ['data.payments'] as const

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
      expand: [...INVOICE_LIST_EXPAND],
    })

    return invoices
  }

  return { list }
})()
