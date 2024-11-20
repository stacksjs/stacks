import type Stripe from 'stripe'
import type { StripePaymentMethod } from '../types/billing'
import mitt from 'mitt'

const emitter = mitt()

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

    async subscribeToPlan(body: { type: string, plan: string, description: string }): Promise<string> {
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

      emitter.emit('subscription:created')

      return client
    },

    async cancelPlan(): Promise<void> {
      const url = 'http://localhost:3008/stripe/cancel-subscription'

      const providerId = this.getCurrentPlan.subscription.provider_id
      const subscriptionId = this.getCurrentPlan.subscription.id
      const body = { providerId, subscriptionId }
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      })

      if (response.status !== 204) {
        await response.json()
      }

      emitter.emit('subscription:canceled')
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

      emitter.emit('paymentMethods:fetched')
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

      emitter.emit('paymentMethod:deleted')
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

      emitter.emit('paymentMethod:updated')
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

      emitter.emit('customer:fetched')
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

      emitter.emit('paymentMethod:fetched')
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
      else {
        this.activeSubscription = {}
      }

      emitter.emit('subscription:fetched')
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
