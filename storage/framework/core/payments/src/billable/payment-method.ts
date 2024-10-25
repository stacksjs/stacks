import type Stripe from 'stripe'
import type { UserModel } from '../../../../orm/src/models/User'
import { stripe } from '..'


export interface ManageCharge {
    addPaymentMethod: (user: UserModel, paymentMethod: string | Stripe.PaymentMethod) =>  Promise<Stripe.PaymentMethod>
}

export const managePaymentMethod: ManageCharge = (() => {
  async function addPaymentMethod(user: UserModel, paymentMethod: string | Stripe.PaymentMethod): Promise<Stripe.PaymentMethod> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    let stripePaymentMethod: Stripe.PaymentMethod

    if (typeof paymentMethod === 'string') {
      stripePaymentMethod = await stripe.paymentMethod.retrieve(paymentMethod)
    } else {
      stripePaymentMethod = paymentMethod
    }

    if (stripePaymentMethod.customer !== user.stripe_id) {
      stripePaymentMethod = await stripe.paymentMethod.attach(stripePaymentMethod.id, {
        customer: user.stripe_id || '',
      })
    }

    return stripePaymentMethod
  }

  async function deletePaymentMethod(user: UserModel, paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethod = await stripe.paymentMethod.retrieve(paymentMethodId)

    if (paymentMethod.customer !== user.stripe_id) {
      throw new Error('Payment method does not belong to this customer')
    }

    return await stripe.paymentMethod.detach(paymentMethodId)
  }

  async function updatePaymentMethod(user: UserModel, paymentMethodId: string, updateParams: Stripe.PaymentMethodUpdateParams): Promise<Stripe.PaymentMethod> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethod = await stripe.paymentMethod.retrieve(paymentMethodId)

    if (paymentMethod.customer !== user.stripe_id) {
      throw new Error('Payment method does not belong to this customer')
    }

    return await stripe.paymentMethod.update(paymentMethodId, updateParams)
  }

  async function retrievePaymentMethod(user: UserModel, paymentMethodId: string): Promise<Stripe.PaymentMethod> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethod = await stripe.paymentMethod.retrieve(paymentMethodId)

    if (paymentMethod.customer !== user.stripe_id) {
      throw new Error('Payment method does not belong to this customer')
    }

    return paymentMethod
  }

  return { addPaymentMethod, deletePaymentMethod, retrievePaymentMethod, updatePaymentMethod }
})()
