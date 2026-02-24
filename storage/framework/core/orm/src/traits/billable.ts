import { db } from '@stacksjs/database'

export function createBillableMethods(_tableName: string) {
  return {
    async createStripeUser(model: any, options: any): Promise<any> {
      const { manageCustomer } = await import('@stacksjs/payments')
      return await manageCustomer.createStripeCustomer(model, options)
    },

    async updateStripeUser(model: any, options: any): Promise<any> {
      const { manageCustomer } = await import('@stacksjs/payments')
      return await manageCustomer.updateStripeCustomer(model, options)
    },

    async deleteStripeUser(model: any): Promise<any> {
      const { manageCustomer } = await import('@stacksjs/payments')
      return await manageCustomer.deleteStripeUser(model)
    },

    async createOrGetStripeUser(model: any, options: any): Promise<any> {
      const { manageCustomer } = await import('@stacksjs/payments')
      return await manageCustomer.createOrGetStripeUser(model, options)
    },

    async retrieveStripeUser(model: any): Promise<any> {
      const { manageCustomer } = await import('@stacksjs/payments')
      return await manageCustomer.retrieveStripeUser(model)
    },

    async defaultPaymentMethod(model: any): Promise<any> {
      const { managePaymentMethod } = await import('@stacksjs/payments')
      return await managePaymentMethod.retrieveDefaultPaymentMethod(model)
    },

    async setDefaultPaymentMethod(model: any, pmId: number): Promise<any> {
      const { managePaymentMethod } = await import('@stacksjs/payments')
      return await managePaymentMethod.setDefaultPaymentMethod(model, pmId)
    },

    async addPaymentMethod(model: any, paymentMethodId: string): Promise<any> {
      const { managePaymentMethod } = await import('@stacksjs/payments')
      return await managePaymentMethod.addPaymentMethod(model, paymentMethodId)
    },

    async paymentMethods(model: any, cardType?: string): Promise<any[]> {
      const { managePaymentMethod } = await import('@stacksjs/payments')
      return await managePaymentMethod.listPaymentMethods(model, cardType)
    },

    async newSubscription(model: any, type: string, lookupKey: string, options: any = {}): Promise<any> {
      const { manageSubscription } = await import('@stacksjs/payments')
      const subscription = await manageSubscription.create(model, type, lookupKey, options)
      const latestInvoice = subscription.latest_invoice as any
      const paymentIntent = latestInvoice?.payment_intent
      return { subscription, paymentIntent }
    },

    async updateSubscription(model: any, type: string, lookupKey: string, options: any = {}): Promise<any> {
      const { manageSubscription } = await import('@stacksjs/payments')
      const subscription = await manageSubscription.update(model, type, lookupKey, options)
      const latestInvoice = subscription.latest_invoice as any
      const paymentIntent = latestInvoice?.payment_intent
      return { subscription, paymentIntent }
    },

    async cancelSubscription(model: any, providerId: string, options: any = {}): Promise<any> {
      const { manageSubscription } = await import('@stacksjs/payments')
      const subscription = await manageSubscription.cancel(providerId, options)
      return { subscription }
    },

    async activeSubscription(model: any): Promise<any> {
      const { manageSubscription } = await import('@stacksjs/payments')
      const subscription = await db.selectFrom('subscriptions')
        .where('user_id', '=', model.id)
        .where('provider_status', '=', 'active')
        .selectAll()
        .executeTakeFirst()

      if (subscription) {
        const providerSubscription = await manageSubscription.retrieve(model, (subscription as any)?.provider_id || '')
        return { subscription, providerSubscription }
      }

      return undefined
    },

    async checkout(model: any, priceIds: any[], options: any = {}): Promise<any> {
      const { manageCheckout, manageCustomer } = await import('@stacksjs/payments')

      const newOptions: any = {}
      if (options.enableTax) {
        newOptions.automatic_tax = { enabled: true }
        delete options.enableTax
      }
      if (options.allowPromotions) {
        newOptions.allow_promotion_codes = true
        delete options.allowPromotions
      }

      const customer = await manageCustomer.createOrGetStripeUser(model, {})
      const defaultOptions = {
        mode: 'payment',
        customer: customer.id,
        line_items: priceIds.map((item: any) => ({
          price: item.priceId,
          quantity: item.quantity || 1,
        })),
      }

      const mergedOptions = { ...defaultOptions, ...newOptions, ...options }
      return await manageCheckout.create(model, mergedOptions)
    },

    async createSetupIntent(model: any, options: any = {}): Promise<any> {
      const { manageSetupIntent } = await import('@stacksjs/payments')
      return await manageSetupIntent.create(model, options)
    },

    async subscriptionHistory(model: any): Promise<any> {
      const { manageInvoice } = await import('@stacksjs/payments')
      return manageInvoice.list(model)
    },

    async transactionHistory(model: any): Promise<any> {
      const { manageTransaction } = await import('@stacksjs/payments')
      return manageTransaction.list(model)
    },
  }
}
