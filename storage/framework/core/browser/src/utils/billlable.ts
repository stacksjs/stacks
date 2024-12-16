import { loadStripe } from '@stripe/stripe-js'

interface PaymentMethod {
  card: any // Replace `any` with the appropriate type for `elements`
  billing_details: {
    name: string
  }
}

interface PaymentParam {
  clientSecret: string
  paymentMethod: PaymentMethod
}

export const publishableKey: string = import.meta.env.FRONTEND_STRIPE_PUBLIC_KEY || ''

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

  const elements = client.elements()
  const cardElement = elements.create('payment')

  cardElement.mount('#payment-element')

  elements.value = client.elements({ clientSecret })

  const paymentElement = elements.value.create('payment', {
    fields: { billingDetails: 'auto' },
  })

  paymentElement.mount('#payment-element')

  return cardElement
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
          name: 'Chris Breuer',
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

    console.log('data from create payment method', data)

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
        // Return URL where the customer should be redirected after the PaymentIntent is confirmed.
        return_url: 'http://localhost:5173/settings/billing',
      },
    },
    )

    const { paymentIntent, error } = data

    return { paymentIntent, error }
  }
  catch (err) {
    console.error('Error confirming card payment:', err)
    return { paymentIntent: null, error: err }
  }
}
