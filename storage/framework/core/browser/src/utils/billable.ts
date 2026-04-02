import { loadStripe } from '@stripe/stripe-js'

const stacksConfig = (globalThis as any).__STACKS_CONFIG__ || {}
export const publishableKey: string = stacksConfig.FRONTEND_STRIPE_PUBLIC_KEY || ''

let client: any

export async function loadCardElement(clientSecret: string): Promise<any> {
  client = await loadStripe(publishableKey)

  const elements = client.elements({ clientSecret })
  const cardElement = elements.create('card')

  cardElement.mount('#card-element')

  return cardElement
}

export async function loadPaymentElement(clientSecret: string): Promise<any> {
  client = await loadStripe(publishableKey)

  const elements = client.elements({ clientSecret })

  const paymentElement = elements.create('payment', {
    fields: { billingDetails: 'auto' },
  })

  paymentElement.mount('#payment-element')

  return elements
}

export async function confirmCardSetup(clientSecret: string, elements: any): Promise<{ setupIntent: any, error: any }> {
  const data = await client.confirmCardSetup(clientSecret, { payment_method: { card: elements } })

  const { setupIntent, error } = data

  return { setupIntent, error }
}

export async function confirmCardPayment(clientSecret: string, elements: any): Promise<{ paymentIntent: any, error: any }> {
  try {
    const data = await client.confirmCardPayment(clientSecret, {
      payment_method: {
        card: elements,
        billing_details: {
          name: stacksConfig.USER_NAME || '',
        },
      },
    })

    const { paymentIntent, error } = data

    return { paymentIntent, error }
  }
  catch (err) {
    console.error('Error confirming card payment:', err)
    return { paymentIntent: null, error: err }
  }
}

export async function createPaymentMethod(elements: any): Promise<{ paymentIntent: any, error: any }> {
  try {
    const data = await client.createPaymentMethod({
      type: 'card',
      card: elements,
    })

    const { paymentIntent, error } = data

    return { paymentIntent, error }
  }
  catch (err) {
    console.error('Error confirming card payment:', err)
    return { paymentIntent: null, error: err }
  }
}

export async function confirmPayment(elements: any): Promise<{ paymentIntent: any, error: any }> {
  try {
    const data = await client.confirmPayment({
      elements,
      confirmParams: {
        return_url: `${window.location.origin}/settings/billing`,
      },
    })

    const { paymentIntent, error } = data

    return { paymentIntent, error }
  }
  catch (err) {
    console.error('Error confirming card payment:', err)
    return { paymentIntent: null, error: err }
  }
}
