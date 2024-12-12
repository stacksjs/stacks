import type Stripe from 'stripe'
import type { PaymentMethodModel } from '../../../../orm/src/models/PaymentMethod'
import type { UserModel } from '../../../../orm/src/models/User'
import { stripe } from '..'
import PaymentMethod from '../../../../orm/src/models/PaymentMethod'

export interface ManagePaymentMethod {
  addPaymentMethod: (user: UserModel, paymentMethod: string | Stripe.PaymentMethod) => Promise<Stripe.Response<Stripe.PaymentMethod>>
  updatePaymentMethod: (user: UserModel, paymentMethodId: string, updateParams?: Stripe.PaymentMethodUpdateParams) => Promise<Stripe.Response<Stripe.PaymentMethod>>
  setDefaultPaymentMethod: (user: UserModel, paymentMethodId: string) => Promise<Stripe.Response<Stripe.Customer>>
  storePaymentMethod: (user: UserModel, paymentMethodId: string) => Promise<PaymentMethodModel>
  deletePaymentMethod: (user: UserModel, paymentMethodId: number) => Promise<Stripe.Response<Stripe.PaymentMethod>>
  retrievePaymentMethod: (user: UserModel, paymentMethodId: number) => Promise<PaymentMethodModel | undefined>
  retrieveDefaultPaymentMethod: (user: UserModel) => Promise<PaymentMethodModel | undefined>
  listPaymentMethods: (user: UserModel, cardType?: string) => Promise<PaymentMethodModel[]>
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

    console.log(stripePaymentMethod)
    storePaymentMethod(user, stripePaymentMethod.id)

    return stripePaymentMethod as Stripe.Response<Stripe.PaymentMethod>
  }

  async function setDefaultPaymentMethod(user: UserModel, paymentMethodId: string): Promise<Stripe.Response<Stripe.Customer>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethod = await stripe.paymentMethod.retrieve(paymentMethodId)

    if (paymentMethod.customer !== user.stripe_id) {
      await stripe.paymentMethod.attach(paymentMethod.id, {
        customer: user.stripe_id || '',
      })
    }

    const updatedCustomer = await stripe.customer.update(user?.stripe_id || '', {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })

    storePaymentMethod(user, paymentMethodId)

    return updatedCustomer
  }

  async function storePaymentMethod(user: UserModel, paymentMethodId: string): Promise<PaymentMethodModel> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethod = await stripe.paymentMethod.retrieve(paymentMethodId)

    const method = {
      type: 'card',
      last_four: Number(paymentMethod.card?.last4),
      brand: paymentMethod.card?.brand,
      exp_year: paymentMethod.card?.exp_year,
      exp_month: paymentMethod.card?.exp_month,
      user_id: user.id,
      provider_id: paymentMethod.id,
    }

    if (paymentMethod.customer !== user.stripe_id) {
      await stripe.paymentMethod.attach(paymentMethod.id, {
        customer: user.stripe_id || '',
      })
    }

    const model = await PaymentMethod.create(method)

    return model
  }

  async function deletePaymentMethod(user: UserModel, paymentMethodId: number): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const pm = await PaymentMethod.find(paymentMethodId)

    const paymentMethod = await stripe.paymentMethod.retrieve(String(pm?.provider_id))

    if (paymentMethod.customer !== user.stripe_id) {
      throw new Error('Payment method does not belong to this customer')
    }

    pm?.delete()

    return await stripe.paymentMethod.detach(String(pm?.provider_id))
  }

  async function updatePaymentMethod(user: UserModel, paymentMethodId: string, updateParams?: Stripe.PaymentMethodUpdateParams): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethod = await stripe.paymentMethod.retrieve(paymentMethodId)

    if (paymentMethod.customer !== user.stripe_id) {
      throw new Error('Payment method does not belong to this customer')
    }

    return await stripe.paymentMethod.update(paymentMethodId, updateParams)
  }

  async function listPaymentMethods(
    user: UserModel,
  ): Promise<PaymentMethodModel[]> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethods = await PaymentMethod.where('user_id', user.id)
      .whereNull('is_default')
      .get()

    return paymentMethods
  }

  async function retrievePaymentMethod(user: UserModel, paymentMethodId: number): Promise<PaymentMethodModel | undefined> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethod = await PaymentMethod.find(paymentMethodId)

    return paymentMethod
  }

  async function retrieveDefaultPaymentMethod(user: UserModel): Promise<PaymentMethodModel | undefined> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethod = await PaymentMethod.where('user_id', user.id)
      .where('is_default', true)
      .first()

    return paymentMethod
  }

  return { addPaymentMethod, deletePaymentMethod, retrieveDefaultPaymentMethod, updatePaymentMethod, listPaymentMethods, setDefaultPaymentMethod, storePaymentMethod, retrievePaymentMethod }
})()
