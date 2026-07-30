import { withCsrfHeader } from '@stacksjs/browser'
import { computed, defineStore, ref } from '@stacksjs/stx'
import { resolveApiBaseUrl } from '../functions/api-url'
import { useAuth } from '../functions/auth'

type PaymentMethod = any
type Product = any
type Subscription = any
type TransactionHistory = any

const apiUrl = resolveApiBaseUrl('')

function authenticatedUserId(): string {
  const id = useAuth().user.value?.id
  if (id === null || id === undefined)
    throw new Error('Authentication required before using the payment store.')
  return encodeURIComponent(String(id))
}

function requestHeaders(write = false): Record<string, string> {
  const token = useAuth().getToken()
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  }
  if (token)
    headers.Authorization = `Bearer ${token}`
  return write ? withCsrfHeader(headers) : headers
}

const paymentStore = defineStore('payment', () => {
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

  const isLoading = computed(() => Object.values(loadingStates.value).some(Boolean))

  const hasPaymentMethods = computed(() =>
    paymentMethods.value.length > 0
    || !(defaultPaymentMethod.value == null
      || (typeof defaultPaymentMethod.value === 'object' && Object.keys(defaultPaymentMethod.value).length === 0)),
  )

  const getDefaultPaymentMethod = computed(() => defaultPaymentMethod.value)
  const getStripeCustomer = computed(() => stripeCustomer.value)
  const getPlanState = computed(() => planState.value)

  async function fetchSetupIntent(id: number): Promise<string> {
    const url = `${apiUrl}/payments/create-setup-intent/${id}`

    const response = await fetch(url, {
      method: 'GET',
      headers: requestHeaders(),
    })

    if (!response.ok) {
      throw new Error(`Failed to fetch setup intent: ${response.status}`)
    }

    const client: any = await response.json()
    const clientSecret = client.client_secret

    return clientSecret
  }

  async function fetchPaymentIntent(id: number, productId: number): Promise<string> {
    const body = { productId }

    const url = `${apiUrl}/payments/create-payment-intent/${id}`

    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders(true),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Failed to create payment intent: ${response.status}`)
    }

    const client: any = await response.json()
    const clientSecret = client.client_secret

    return clientSecret
  }

  async function storeTransaction(id: number, productId: number): Promise<string> {
    const body = { productId }

    const url = `${apiUrl}/payments/store-transaction/${id}`

    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders(true),
      body: JSON.stringify(body),
    })

    if (!response.ok) {
      throw new Error(`Failed to store transaction: ${response.status}`)
    }

    const client: any = await response.json()
    const clientSecret = client.client_secret

    return clientSecret
  }

  async function subscribeToPlan(body: { type: string, plan: string, description: string }): Promise<string> {
    const url = `${apiUrl}/payments/create-subscription/${authenticatedUserId()}`

    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders(true),
      body: JSON.stringify(body),
    })

    const client: any = await response.json()

    return client
  }

  async function updatePlan(body: { type: string, plan: string, description: string }): Promise<string> {
    const url = `${apiUrl}/payments/update-subscription/${authenticatedUserId()}`

    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders(true),
      body: JSON.stringify(body),
    })

    const client: any = await response.json()

    return client
  }

  async function setDefaultPaymentMethod(paymentId: string): Promise<string> {
    const url = `${apiUrl}/payments/set-default-payment-method/${authenticatedUserId()}`

    const body = { paymentId }

    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders(true),
      body: JSON.stringify(body),
    })

    const res: any = await response.json()

    return res
  }

  async function setUserDefaultPaymentMethod(setupIntent: string): Promise<string> {
    const url = `${apiUrl}/payments/user-default-payment-method/${authenticatedUserId()}`

    const body = { setupIntent }

    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders(true),
      body: JSON.stringify(body),
    })

    const res: any = await response.json()

    return res
  }

  async function storePaymentMethod(setupIntent: string): Promise<string> {
    const url = `${apiUrl}/payments/payment-method/${authenticatedUserId()}`

    const body = { setupIntent }

    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders(true),
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

    const url = `${apiUrl}/payments/fetch-user-subscriptions/${authenticatedUserId()}`

    const response = await fetch(url, {
      method: 'GET',
      headers: requestHeaders(),
    })

    if (response.status !== 204) {
      const res = await response.json() as any[]

      subscriptions.value = res
    }

    removeLoadingState('fetchSubscriptions')
  }

  async function cancelPlan(): Promise<void> {
    const url = `${apiUrl}/payments/cancel-subscription/${authenticatedUserId()}`

    const providerId = getCurrentPlan.value.subscription.provider_id
    const subscriptionId = getCurrentPlan.value.subscription.id
    const body = { providerId, subscriptionId }
    const response = await fetch(url, {
      method: 'POST',
      headers: requestHeaders(true),
      body: JSON.stringify(body),
    })

    if (response.status !== 204)
      await response.json()
  }

  async function fetchUserPaymentMethods(id: number): Promise<void> {
    setLoadingState('fetchUserPaymentMethods')

    const response: any = await fetch(`${apiUrl}/payments/payment-methods/${id}`, {
      method: 'GET',
      headers: requestHeaders(),
    })

    if (response.status !== 204) {
      const res = await response.json()

      paymentMethods.value = res
    }

    removeLoadingState('fetchUserPaymentMethods')
  }

  async function fetchTransactionHistory(id: number): Promise<void> {
    setLoadingState('fetchTransactionHistory')

    const response: any = await fetch(`${apiUrl}/payments/fetch-transaction-history/${id}`, {
      method: 'GET',
      headers: requestHeaders(),
    })

    if (response.status !== 204) {
      const res = await response.json()

      transactionHistory.value = res.data
    }

    removeLoadingState('fetchTransactionHistory')
  }

  async function deletePaymentMethod(paymentMethod: number): Promise<void> {
    setLoadingState('deletePaymentMethod')
    const url = `${apiUrl}/payments/delete-payment-method/${authenticatedUserId()}`

    const body = { paymentMethod }

    try {
      await fetch(url, {
        method: 'DELETE',
        headers: requestHeaders(true),
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

    const url = `${apiUrl}/payments/update-default-payment-method/${authenticatedUserId()}`

    const body = { paymentMethod }

    try {
      await fetch(url, {
        method: 'PUT',
        headers: requestHeaders(true),
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
      headers: requestHeaders(),
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
      headers: requestHeaders(),
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
      headers: requestHeaders(),
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
      headers: requestHeaders(),
    })

    if (response.status !== 204) {
      const res = await response.json()

      activeSubscription.value = res
    }
    else {
      activeSubscription.value = {}
    }

    removeLoadingState('fetchActivePlan')
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

/**
 * Match the conventional Vue-style `useXStore()` call shape while keeping
 * STX's `defineStore()` singleton semantics.
 */
export function usePaymentStore() {
  return paymentStore
}
