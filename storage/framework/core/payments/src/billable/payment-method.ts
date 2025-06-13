import type { Selectable } from '@stacksjs/database'
import type { PaymentMethodModel, PaymentMethodsTable, UserModel } from '@stacksjs/orm'
import type Stripe from 'stripe'
import { db } from '@stacksjs/database'
import { PaymentMethod } from '@stacksjs/orm'
import { stripe } from '..'

export interface ManagePaymentMethod {
  addPaymentMethod: (user: UserModel, paymentMethod: string | Stripe.PaymentMethod) => Promise<Stripe.Response<Stripe.PaymentMethod>>
  updatePaymentMethod: (user: UserModel, paymentMethodId: string, updateParams?: Stripe.PaymentMethodUpdateParams) => Promise<Stripe.Response<Stripe.PaymentMethod>>
  setUserDefaultPayment: (user: UserModel, paymentMethodId: string) => Promise<Stripe.Response<Stripe.Customer>>
  setDefaultPaymentMethod: (user: UserModel, paymentMethodId: number) => Promise<Stripe.Response<Stripe.Customer>>
  storePaymentMethod: (user: UserModel, paymentMethodId: Stripe.PaymentMethod) => Promise<PaymentMethodModel>
  deletePaymentMethod: (user: UserModel, paymentMethodId: number) => Promise<Stripe.Response<Stripe.PaymentMethod>>
  retrievePaymentMethod: (user: UserModel, paymentMethodId: number) => Promise<PaymentMethodModel | undefined>
  retrieveDefaultPaymentMethod: (user: UserModel) => Promise<PaymentMethodModel | undefined>
  listPaymentMethods: (user: UserModel, cardType?: string) => Promise<Selectable<PaymentMethodsTable>[]>
}

export const managePaymentMethod: ManagePaymentMethod = (() => {
  async function addPaymentMethod(user: UserModel, paymentMethod: string | Stripe.PaymentMethod): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    let stripePaymentMethod

    if (typeof paymentMethod === 'string') {
      stripePaymentMethod = await stripe.paymentMethods.retrieve(paymentMethod)
    }
    else {
      stripePaymentMethod = paymentMethod
    }

    if (stripePaymentMethod.customer !== user.stripe_id) {
      stripePaymentMethod = await stripe.paymentMethods.attach(stripePaymentMethod.id, {
        customer: user.stripe_id || '',
      })
    }

    storePaymentMethod(user, stripePaymentMethod)

    return stripePaymentMethod as Stripe.Response<Stripe.PaymentMethod>
  }

  async function setUserDefaultPayment(user: UserModel, paymentMethodId: string): Promise<Stripe.Response<Stripe.Customer>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)

    const paymentMethodModel = await db.selectFrom('payment_methods').where('provider_id', '=', paymentMethodId).selectAll().executeTakeFirst()

    if (paymentMethod.customer !== user.stripe_id) {
      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: user.stripe_id || '',
      })
    }

    const updatedCustomer = await stripe.customers.update(user?.stripe_id || '', {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })

    updateDefault(paymentMethodModel as PaymentMethodModel)

    return updatedCustomer
  }

  async function setDefaultPaymentMethod(user: UserModel, paymentId: number): Promise<Stripe.Response<Stripe.Customer>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const pm = await db.selectFrom('payment_methods').where('id', '=', paymentId).selectAll().executeTakeFirst()

    const paymentMethod = await stripe.paymentMethods.retrieve(String(pm?.provider_id))

    if (paymentMethod.customer !== user.stripe_id) {
      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: user.stripe_id || '',
      })
    }

    const updatedCustomer = await stripe.customers.update(user?.stripe_id || '', {
      invoice_settings: {
        default_payment_method: String(pm?.provider_id),
      },
    })

    await db.updateTable('payment_methods').set({ is_default: false }).where('user_id', '=', 1).executeTakeFirst()

    await db.updateTable('payment_methods').set({ is_default: true }).where('id', '=', paymentId).executeTakeFirst()

    return updatedCustomer
  }

  async function storePaymentMethod(user: UserModel, paymentMethod: Stripe.PaymentMethod): Promise<PaymentMethodModel> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    if (!paymentMethod.card?.brand || !paymentMethod.card?.exp_year || !paymentMethod.card?.exp_month) {
      throw new Error('Invalid payment method: missing required card details')
    }

    const method = {
      type: 'card',
      last_four: Number(paymentMethod.card.last4),
      brand: paymentMethod.card.brand,
      exp_year: paymentMethod.card.exp_year,
      exp_month: paymentMethod.card.exp_month,
      user_id: user.id,
      provider_id: paymentMethod.id,
    }

    if (paymentMethod.customer !== user.stripe_id) {
      await stripe.paymentMethods.attach(paymentMethod.id, {
        customer: user.stripe_id || '',
      })
    }

    const model = await PaymentMethod.create(method)

    return model
  }

  async function updateDefault(paymentMethodModel: PaymentMethodModel): Promise<PaymentMethodModel> {
    const paymentMethod = await paymentMethodModel.update({ is_default: true })

    return paymentMethod as PaymentMethodModel
  }

  async function deletePaymentMethod(user: UserModel, paymentMethodId: number): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const pm = await PaymentMethod.find(paymentMethodId)

    const paymentMethod = await stripe.paymentMethods.retrieve(String(pm?.provider_id))

    if (paymentMethod.customer !== user.stripe_id) {
      throw new Error('Payment method does not belong to this customer')
    }

    pm?.delete()

    return await stripe.paymentMethods.detach(String(pm?.provider_id))
  }

  async function updatePaymentMethod(user: UserModel, paymentMethodId: string, updateParams?: Stripe.PaymentMethodUpdateParams): Promise<Stripe.Response<Stripe.PaymentMethod>> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)

    if (paymentMethod.customer !== user.stripe_id) {
      throw new Error('Payment method does not belong to this customer')
    }

    return await stripe.paymentMethods.update(paymentMethodId, updateParams)
  }

  async function listPaymentMethods(
    user: UserModel,
  ): Promise<Selectable<PaymentMethodsTable>[]> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethods = await db.selectFrom('payment_methods').selectAll().where(eb => eb.or([
      eb('is_default', 'is', null),
      eb('is_default', '=', false),
    ])).where('user_id', '=', user.id).execute()

    return paymentMethods
  }

  async function retrievePaymentMethod(user: UserModel, paymentMethodId: number): Promise<PaymentMethodModel | undefined> {
    if (!user.hasStripeId()) {
      throw new Error('Customer does not exist in Stripe')
    }

    const paymentMethod = await db.selectFrom('payment_methods').where('id', '=', paymentMethodId).selectAll().executeTakeFirst()

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

  return { addPaymentMethod, deletePaymentMethod, retrieveDefaultPaymentMethod, updatePaymentMethod, listPaymentMethods, setDefaultPaymentMethod, storePaymentMethod, retrievePaymentMethod, setUserDefaultPayment }
})()
