import type Stripe from 'stripe'
import type { UserModel } from '../../../../orm/src/models/User'
import { stripe } from '..'

export interface ManagePaymentMethod {
  addPaymentMethod: (user: UserModel, paymentMethod: string | Stripe.PaymentMethod) => Promise<Stripe.Response<Stripe.PaymentMethod>>
  updatePaymentMethod: (user: UserModel, paymentMethodId: string, updateParams: Stripe.PaymentMethodUpdateParams) => Promise<Stripe.Response<Stripe.PaymentMethod>>
  deletePaymentMethod: (user: UserModel, paymentMethodId: string) => Promise<Stripe.Response<Stripe.PaymentMethod>>
  retrievePaymentMethod: (user: UserModel, paymentMethodId: string) => Promise<Stripe.Response<Stripe.PaymentMethod>>
  listPaymentMethods: (user: UserModel, cardType?: string) => Promise<Stripe.Response<Stripe.ApiList<Stripe.PaymentMethod>>>
}

export const managePaymentMethod: ManagePaymentMethod = (() => {
  async function addPaymentMethod(user: UserModel, paymentMethod: string | Stripe.PaymentMethod): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    let stripePaymentMethod

    if (typeof paymentMethod === 'string') {
      stripePaymentMethod = await stripe.paymentMethod.retrieve(paymentMethod)
    }
    else {
      stripePaymentMethod = paymentMethod
    }

    if (stripePaymentMethod.customer !== user.stripe_id) {
      stripePaymentMethod = await stripe.paymentMethod.attach(stripePaymentMethod.id, {
        customer: user.stripe_id || '',
      })
    }

    return stripePaymentMethod as Stripe.Response<Stripe.PaymentMethod>
  }

  async function deletePaymentMethod(user: UserModel, paymentMethodId: string): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethod = await stripe.paymentMethod.retrieve(paymentMethodId)

    if (paymentMethod.customer !== user.stripe_id) {
      throw new Error('Payment method does not belong to this customer')
    }

    return await stripe.paymentMethod.detach(paymentMethodId)
  }

  async function updatePaymentMethod(user: UserModel, paymentMethodId: string, updateParams: Stripe.PaymentMethodUpdateParams): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethod = await stripe.paymentMethod.retrieve(paymentMethodId)

    if (paymentMethod.customer !== user.stripe_id) {
      throw new Error('Payment method does not belong to this customer')
    }

    return await stripe.paymentMethod.update(paymentMethodId, updateParams)
  }

  async function listPaymentMethods(user: UserModel, cardType?: string): Promise<Stripe.Response<Stripe.ApiList<Stripe.PaymentMethod>>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethods = await stripe.paymentMethod.list({
      customer: user.stripe_id,
      type: 'card',
    })

    if (cardType) {
      paymentMethods.data = paymentMethods.data.filter(method => method.card?.brand === cardType)
    }

    return paymentMethods
  }

  async function retrievePaymentMethod(user: UserModel, paymentMethodId: string): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethod = await stripe.paymentMethod.retrieve(paymentMethodId)

    if (paymentMethod.customer !== user.stripe_id) {
      throw new Error('Payment method does not belong to this customer')
    }

    return paymentMethod
  }

  return { addPaymentMethod, deletePaymentMethod, retrievePaymentMethod, updatePaymentMethod, listPaymentMethods }
})()
