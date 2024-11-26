import type Stripe from 'stripe'
import type { StripePaymentMethod } from '../types/billing'
import { dispatch } from '@stacksjs/events'

const apiUrl = `http://localhost:3008`

export const usePaymentStore = defineStore('payment', {
  state: (): any => {
    return {
      loadingStates: {} as Record<string, boolean>,
      paymentMethods: [] as StripePaymentMethod[],
      transactionHistory: [] as Stripe.Invoice[],
      defaultPaymentMethod: {} as StripePaymentMethod,
      activeSubscription: {} as Stripe.Subscription,
      subscriptions: [] as Stripe.Subscription[],
      stripeCustomer: {} as Stripe.Customer,
      paymentPlans: [] as any[],
      planState: false as boolean,
    }
  },

  actions: {
    async fetchSetupIntent(): Promise<string> {
      const url = 'http://localhost:3008/payments/create-setup-intent'

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
      const url = 'http://localhost:3008/payments/create-subscription'

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const client: any = await response.json()

      dispatch('subscription:created')

      return client
    },

    async updatePlan(body: { type: string, plan: string, description: string }): Promise<string> {
      const url = 'http://localhost:3008/payments/update-subscription'

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
      })

      const client: any = await response.json()

      dispatch('subscription:updated')

      return client
    },

    openPlans() {
      this.planState = true
    },

    closePlans() {
      this.planState = false
    },

    async fetchSubscriptions(): Promise<void> {
      this.setLoadingState('fetchSubscriptions')

      const url = 'http://localhost:3008/payments/fetch-user-subscriptions'

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      })

      if (response.status !== 204) {
        const res = await response.json()

        this.subscriptions = res
      }
      await response.json()

      this.removeLoadingState('fetchSubscriptions')

      dispatch('subscription:created')
    },

    async cancelPlan(): Promise<void> {
      const url = 'http://localhost:3008/payments/cancel-subscription'

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

      if (response.status !== 204)
        await response.json()

      dispatch('subscription:canceled')
    },

    async fetchUserPaymentMethods(): Promise<void> {
      this.setLoadingState('fetchUserPaymentMethods')

      const response: any = await fetch(`${apiUrl}/payments/user-payment-methods`, {
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

      this.removeLoadingState('fetchUserPaymentMethods')

      dispatch('paymentMethods:fetched')
    },

    async fetchTransactionHistory(): Promise<void> {
      this.setLoadingState('fetchTransactionHistory')

      const response: any = await fetch(`${apiUrl}/payments/fetch-transaction-history`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
      })

      if (response.status !== 204) {
        const res = await response.json()

        this.transactionHistory = res.data
      }

      this.removeLoadingState('fetchTransactionHistory')

      dispatch('paymentMethods:fetched')
    },

    async deletePaymentMethod(paymentMethod: string): Promise<void> {
      this.setLoadingState('deletePaymentMethod')
      const url = 'http://localhost:3008/payments/delete-payment-method'

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

      this.removeLoadingState('deletePaymentMethod')

      dispatch('paymentMethod:deleted')
    },

    async updateDefaultPaymentMethod(paymentMethod: string): Promise<void> {
      this.setLoadingState('updateDefaultPaymentMethod')

      const url = 'http://localhost:3008/payments/update-default-payment-method'

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

      this.removeLoadingState('updateDefaultPaymentMethod')

      dispatch('paymentMethod:updated')
    },

    async fetchStripeCustomer(): Promise<void> {
      this.setLoadingState('fetchStripeCustomer')

      const response: any = await fetch(`${apiUrl}/payments/fetch-customer`, {
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

      this.removeLoadingState('fetchStripeCustomer')

      dispatch('customer:fetched')
    },

    async fetchDefaultPaymentMethod(): Promise<void> {
      this.setLoadingState('fetchDefaultPaymentMethod')

      const response: any = await fetch(`${apiUrl}/payments/default-payment-method`, {
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

      this.removeLoadingState('fetchDefaultPaymentMethod')

      dispatch('paymentMethod:fetched')
    },

    async fetchUserActivePlan(): Promise<void> {
      this.setLoadingState('fetchActivePlan')
      const response: any = await fetch(`${apiUrl}/payments/fetch-active-subscription`, {
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

      this.removeLoadingState('fetchActivePlan')

      dispatch('subscription:fetched')
    },

    setLoadingState(statusKey: string): void {
      this.loadingStates[statusKey] = true
    },
    removeLoadingState(statusKey: string): void {
      this.loadingStates[statusKey] = false
    },
    isStateLoading(statusKey: string): boolean {
      return this.loadingStates[statusKey] === undefined ? true : this.loadingStates[statusKey]
    },
  },

  getters: {
    isLoading: state => state.loadingStates.size > 0,
    getPaymentMethods: (state): StripePaymentMethod[] => state.paymentMethods,
    getCurrentPlan: (state): Stripe.Subscription => state.activeSubscription,
    getTransactionHistory: (state): Stripe.Invoice[] => state.transactionHistory,
    hasPaymentMethods: (state): boolean =>
      state.paymentMethods.length > 0
      || !(state.defaultPaymentMethod == null
        || (typeof state.defaultPaymentMethod === 'object' && Object.keys(state.defaultPaymentMethod).length === 0)),

    getDefaultPaymentMethod: (state): StripePaymentMethod[] => state.defaultPaymentMethod,
    getStripeCustomer: (state): any => state.stripeCustomer,
    getPlanState: (state): boolean => state.planState,
  },
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(usePaymentStore, import.meta.hot))
