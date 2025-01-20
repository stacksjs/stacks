import type { PaymentMethod, Product, Subscription, TransactionHistory } from '../types/billing'

const apiUrl = `http://localhost:3008`

export const usePaymentStore = defineStore('payment', () => {
  // TODO: update the any types
  const loadingStates = ref<Record<string, boolean>>({})
  const paymentMethods = ref<PaymentMethod[]>([])
  const transactionHistory = ref<TransactionHistory[]>([])
  const defaultPaymentMethod = ref<PaymentMethod>({} as PaymentMethod)
  const product = ref<Product>({} as Product)
  const activeSubscription = ref<Subscription>({} as Subscription)
  const subscriptions = ref<Subscription[]>([])
  const stripeCustomer = ref<any>({} as any)
  const planState = ref<boolean>(false)

  const getPaymentMethods = computed(() => paymentMethods.value)
  const getProduct = computed(() => product.value)
  const getCurrentPlan = computed(() => activeSubscription.value)
  const getTransactionHistory = computed(() => transactionHistory.value)

  const isLoading = computed(() => loadingStates.value.size)

  const hasPaymentMethods = computed(() =>
    paymentMethods.value.length > 0
    || !(defaultPaymentMethod.value == null
      || (typeof defaultPaymentMethod.value === 'object' && Object.keys(defaultPaymentMethod.value).length === 0)),
  )

  const getDefaultPaymentMethod = computed(() => defaultPaymentMethod.value)
  const getStripeCustomer = computed(() => stripeCustomer.value)
  const getPlanState = computed(() => planState.value)

  async function fetchSetupIntent(id: number): Promise<string> {
    const url = `http://localhost:3008/payments/create-setup-intent/${id}`

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
  }

  async function fetchPaymentIntent(id: number, productId: number): Promise<string> {
    const body = { productId }

    const url = `http://localhost:3008/payments/create-payment-intent/${id}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const client: any = await response.json()
    const clientSecret = client.client_secret

    return clientSecret
  }

  async function storeTransaction(id: number, productId: number): Promise<string> {
    const body = { productId }

    const url = `http://localhost:3008/payments/store-transaction/${id}`

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    })

    const client: any = await response.json()
    const clientSecret = client.client_secret

    return clientSecret
  }

  async function subscribeToPlan(body: { type: string, plan: string, description: string }): Promise<string> {
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
  }

  async function updatePlan(body: { type: string, plan: string, description: string }): Promise<string> {
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

    return client
  }

  async function setDefaultPaymentMethod(paymentId: string): Promise<string> {
    const url = 'http://localhost:3008/payments/set-default-payment-method/1'

    const body = { paymentId }

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
  }

  async function setUserDefaultPaymentMethod(setupIntent: string): Promise<string> {
    const url = 'http://localhost:3008/payments/user-default-payment-method/1'

    const body = { setupIntent }

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
  }

  async function storePaymentMethod(setupIntent: string): Promise<string> {
    const url = 'http://localhost:3008/payments/payment-method/1'

    const body = { setupIntent }

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
  }

  function openPlans() {
    planState.value = true
  }

  function closePlans() {
    planState.value = false
  }

  async function fetchSubscriptions(): Promise<void> {
    setLoadingState('fetchSubscriptions')

    const url = 'http://localhost:3008/payments/fetch-user-subscriptions'

    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    if (response.status !== 204) {
      const res = await response.json() as any[]

      subscriptions.value = res
    }
    await response.json()

    removeLoadingState('fetchSubscriptions')
  }

  async function cancelPlan(): Promise<void> {
    const url = 'http://localhost:3008/payments/cancel-subscription'

    const providerId = getCurrentPlan.value.subscription.provider_id
    const subscriptionId = getCurrentPlan.value.subscription.id
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
  }

  async function fetchUserPaymentMethods(id: number): Promise<void> {
    setLoadingState('fetchUserPaymentMethods')

    const response: any = await fetch(`${apiUrl}/payments/payment-methods/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    if (response.status !== 204) {
      const res = await response.json()

      paymentMethods.value = res
    }

    removeLoadingState('fetchUserPaymentMethods')

    dispatch('paymentMethods:fetched')
  }

  async function fetchTransactionHistory(id: number): Promise<void> {
    setLoadingState('fetchTransactionHistory')

    const response: any = await fetch(`${apiUrl}/payments/fetch-transaction-history/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    if (response.status !== 204) {
      const res = await response.json()

      transactionHistory.value = res.data
    }

    removeLoadingState('fetchTransactionHistory')
  }

  async function deletePaymentMethod(paymentMethod: number): Promise<void> {
    setLoadingState('deletePaymentMethod')
    const url = 'http://localhost:3008/payments/delete-payment-method/1'

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
      // eslint-disable-next-line no-console
      console.log(err)
    }

    removeLoadingState('deletePaymentMethod')
  }

  async function updateDefaultPaymentMethod(paymentMethod: string): Promise<void> {
    setLoadingState('updateDefaultPaymentMethod')

    const url = 'http://localhost:3008/payments/update-default-payment-method/1'

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
      // eslint-disable-next-line no-console
      console.log(err)
    }

    removeLoadingState('updateDefaultPaymentMethod')
  }

  async function fetchStripeCustomer(id: number): Promise<void> {
    setLoadingState('fetchStripeCustomer')

    const response: any = await fetch(`${apiUrl}/payments/fetch-customer/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    if (response.status !== 204) {
      const res = await response.json()
      stripeCustomer.value = res
    }

    removeLoadingState('fetchStripeCustomer')
  }

  async function fetchDefaultPaymentMethod(id: number): Promise<void> {
    setLoadingState('fetchDefaultPaymentMethod')

    const response: any = await fetch(`${apiUrl}/payments/default-payment-method/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    if (response.status !== 204) {
      const res = await response.json()

      defaultPaymentMethod.value = res
    }

    removeLoadingState('fetchDefaultPaymentMethod')
  }

  async function fetchProduct(id: number): Promise<void> {
    setLoadingState('fetchProduct')

    const response: any = await fetch(`${apiUrl}/payments/fetch-product/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    if (response.status !== 204) {
      const res = await response.json()

      product.value = res
    }

    removeLoadingState('fetchProduct')
  }

  async function fetchUserActivePlan(id: number): Promise<void> {
    setLoadingState('fetchActivePlan')
    const response: any = await fetch(`${apiUrl}/payments/fetch-active-subscription/${id}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    })

    if (response.status !== 204) {
      const res = await response.json()

      activeSubscription.value = res
    }
    else {
      activeSubscription.value = {}
    }

    removeLoadingState('fetchActivePlan')

    dispatch('subscription:fetched')
  }

  function setLoadingState(statusKey: string): void {
    loadingStates.value[statusKey] = true
  }

  function removeLoadingState(statusKey: string): void {
    loadingStates.value[statusKey] = false
  }

  function isStateLoading(statusKey: string): boolean {
    return loadingStates.value[statusKey] === undefined ? true : loadingStates.value[statusKey]
  }

  return {
    paymentMethods,
    defaultPaymentMethod,
    stripeCustomer,
    product,
    activeSubscription,
    transactionHistory,
    isLoading,
    getPaymentMethods,
    getProduct,
    getCurrentPlan,
    getTransactionHistory,
    hasPaymentMethods,
    getDefaultPaymentMethod,
    getStripeCustomer,
    getPlanState,
    fetchSetupIntent,
    fetchPaymentIntent,
    storeTransaction,
    subscribeToPlan,
    updatePlan,
    setDefaultPaymentMethod,
    setUserDefaultPaymentMethod,
    storePaymentMethod,
    openPlans,
    closePlans,
    fetchSubscriptions,
    cancelPlan,
    fetchUserPaymentMethods,
    fetchTransactionHistory,
    deletePaymentMethod,
    updateDefaultPaymentMethod,
    fetchStripeCustomer,
    fetchDefaultPaymentMethod,
    fetchProduct,
    isStateLoading,
    fetchUserActivePlan,

  }
})

if (import.meta.hot)
  import.meta.hot.accept(acceptHMRUpdate(usePaymentStore, import.meta.hot))
