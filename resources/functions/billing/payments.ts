import { loadStripe } from '@stripe/stripe-js'

export const publishableKey = import.meta.env.FRONTEND_STRIPE_PUBLIC_KEY
const paymentStore = usePaymentStore()

const stripe = ref(null as any)

export function useBillable() {
  async function fetchSetupIntent(): Promise<string> {
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
  }

  async function subscribeToPlan(body: { type: string, plan: string }): Promise<string> {
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
  }

  async function loadStripeElement(clientSecret: string): Promise<any> {
    stripe.value = await loadStripe(publishableKey)

    const elements = stripe.value.elements()
    const cardElement = elements.create('card')

    cardElement.mount('#payment-element')

    return cardElement

    // if (stripe) {
    //   elements.value = stripe.value.elements({ clientSecret })

    //   const paymentElement = elements.value.create('payment', {
    //     fields: { billingDetails: 'auto' },
    //   })

    //   paymentElement.mount('#payment-element')

    //   return true
    // }

    // return false
  }

  async function setDefaultPaymentMethod(setupIntent: string): Promise<string> {
    const url = 'http://localhost:3008/stripe/set-default-payment-method'

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

  async function handleAddPaymentMethod(clientSecret: string, elements: any) {
    if (!stripe.value || !elements)
      return

    const { setupIntent, error } = await stripe.value.confirmCardSetup(
      clientSecret,
      {
        payment_method: {
          card: elements,
          billing_details: { name: 'Chris Breuer' },
        },
      },
    )

    if (error) {
      console.error(error.message)
    } // Display or handle error for the user
    else {
      if (!paymentStore.hasPaymentMethods)
        await setDefaultPaymentMethod(setupIntent.payment_method)

      alert('Successfully saved payment method!')
    }
  }

  function isEmpty(object: any) {
    return !object // Checks for null or undefined
      || (typeof object === 'object'
        && Object.keys(object).length === 0)
  }

  return { fetchSetupIntent, loadStripeElement, handleAddPaymentMethod, subscribeToPlan, isEmpty }
}
