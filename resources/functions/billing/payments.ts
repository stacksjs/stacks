import { loadStripe } from '@stripe/stripe-js'

export const publishableKey = import.meta.env.FRONTEND_STRIPE_PUBLIC_KEY

const stripe = ref(null as any)
const elements = ref(null as any)

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

  async function loadStripeElement(clientSecret: string): Promise<boolean> {
    stripe.value = await loadStripe(publishableKey)

    if (stripe) {
      elements.value = stripe.value.elements({ clientSecret })

      const paymentElement = elements.value.create('payment', {
        fields: { billingDetails: 'auto' },
      })

      paymentElement.mount('#payment-element')

      return true
    }

    return false
  }

  async function handleAddPaymentMethod() {
    if (!stripe.value || !elements.value)
      return

    const { setupIntent, error } = await stripe.value.confirmSetup({
      elements: elements.value,
      confirmParams: {
        return_url: 'http://localhost:5173/settings/billing',
      },
    })

    if (error) {
      console.error(error.message) // Display or handle error for the user
    }
    else {
      console.log('Setup Intent successful:', setupIntent)
      // You might save setupIntent.id to your database here
    }
  }

  return { fetchSetupIntent, loadStripeElement, handleAddPaymentMethod, subscribeToPlan }
}
