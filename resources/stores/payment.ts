import type Stripe from 'stripe'
import type { StripePaymentMethod } from '../types/billing'

const apiUrl = `http://localhost:3008`

export const usePaymentStore = defineStore('payment', {
  state: (): any => {
    return {
      paymentMethods: [] as StripePaymentMethod[],
      defaultPaymentMethod: {} as StripePaymentMethod,
      stripeCustomer: {} as Stripe.Customer,
      paymentPlans: [] as any[],
    }
  },

  actions: {
    async fetchUserPaymentMethods(): Promise<void> {
      const response: any = await fetch(`${apiUrl}/stripe/user-payment-methods`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }).then(res => res.json())

      this.paymentMethods = response.data
    },

    async deletePaymentMethod(paymentMethod: string): Promise<string> {
      const url = 'http://localhost:3008/stripe/delete-payment-method'

      const body = { paymentMethod }

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const res: any = await response.json()

      return res
    },

    async fetchStripeCustomer(): Promise<void> {
      const response: any = await fetch(`${apiUrl}/stripe/fetch-customer`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }).then(res => res.json())

      this.stripeCustomer = response
    },

    async fetchDefaultPaymentMethod(): Promise<void> {
      const response: any = await fetch(`${apiUrl}/stripe/default-payment-method`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      }).then(res => res.json())

      this.defaultPaymentMethod = response
    },
  },

  getters: {
    getPaymentMethods(state): StripePaymentMethod[] {
      return state.paymentMethods
    },
    hasPaymentMethods(state): boolean {
      return state.paymentMethods.length || !(!state.defaultPaymentMethod // Checks for null or undefined
        || (typeof state.defaultPaymentMethod === 'object'
          && Object.keys(state.defaultPaymentMethod).length === 0))
    },
    getDefaultPaymentMethod(state): StripePaymentMethod[] {
      return state.defaultPaymentMethod
    },
    getStripeCustomer(state): any {
      return state.stripeCustomer
    },
  },
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(usePaymentStore, import.meta.hot))
