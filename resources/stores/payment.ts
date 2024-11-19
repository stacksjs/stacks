import type Stripe from 'stripe'
import type { StripePaymentMethod } from '../types/billing'

const apiUrl = `http://localhost:3008`

export const usePaymentStore = defineStore('payment', {
  state: (): any => {
    return {
      paymentMethods: [] as StripePaymentMethod[],
      defaultPaymentMethod: {} as StripePaymentMethod,
      activeSubscription: {} as Stripe.Subscription,
      stripeCustomer: {} as Stripe.Customer,
      paymentPlans: [] as any[],
    }
  },

  actions: {
    async fetchSetupIntent(): Promise<string> {
      const url = 'http://localhost:3008/stripe/create-setup-intent'

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      })

      const client: any = await response.json()
      const clientSecret = client.client_secret

      return clientSecret
    },

    async subscribeToPlan(body: { type: string, plan: string }): Promise<string> {
      const url = 'http://localhost:3008/stripe/create-subscription'

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const client: any = await response.json()

      return client
    },

    async fetchUserPaymentMethods(): Promise<void> {
      const response: any = await fetch(`${apiUrl}/stripe/user-payment-methods`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      })

      if (response.status !== 204) {
        const res = await response.json()

        this.paymentMethods = res.data
      }
    },

    async deletePaymentMethod(paymentMethod: string): Promise<void> {
      const url = 'http://localhost:3008/stripe/delete-payment-method'

      const body = { paymentMethod }

      try {
        await fetch(url, {
          method: 'DELETE',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(body),
        })
      }
      catch (err: any) {
        console.log(err)
      }
    },

    async updateDefaultPaymentMethod(paymentMethod: string): Promise<void> {
      const url = 'http://localhost:3008/stripe/update-default-payment-method'

      const body = { paymentMethod }

      try {
        await fetch(url, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify(body),
        })
      }
      catch (err: any) {
        console.log(err)
      }
    },

    async fetchStripeCustomer(): Promise<void> {
      const response: any = await fetch(`${apiUrl}/stripe/fetch-customer`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      })

      if (response.status !== 204) {
        const res = await response.json()
        this.stripeCustomer = res
      }
    },

    async fetchDefaultPaymentMethod(): Promise<void> {
      const response: any = await fetch(`${apiUrl}/stripe/default-payment-method`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      })

      if (response.status !== 204) {
        const res = await response.json()

        this.defaultPaymentMethod = res
      }
    },

    async fetchUserActivePlan(): Promise<void> {
      const response: any = await fetch(`${apiUrl}/stripe/fetch-active-subscription`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      })

      if (response.status !== 204) {
        const res = await response.json()

        this.activeSubscription = res
      }
    },
  },

  getters: {
    getPaymentMethods(state): StripePaymentMethod[] {
      return state.paymentMethods
    },
    getCurrentPlan(state): Stripe.Subscription {
      return state.activeSubscription
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
