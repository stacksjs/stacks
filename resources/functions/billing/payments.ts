export const publishableKey = import.meta.env.FRONTEND_STRIPE_PUBLIC_KEY
import { loadStripe } from '@stripe/stripe-js'

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

    async function loadStripeElement(clientSecret: string): Promise<any | undefined> {
      const stripe = await loadStripe(publishableKey)

      if (stripe) {
        const elements = stripe.elements({ clientSecret })
        const paymentElement = elements.create('payment', {
          fields: { billingDetails: 'auto' },
        })

        return paymentElement
      }

      return undefined
    }

    return { fetchSetupIntent, loadStripeElement }
}