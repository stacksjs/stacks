import { loadStripe } from '@stripe/stripe-js'
import { ref } from 'vue'

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

const client = ref(null as any)

export async function loadCardElement(): Promise<any> {
  client.value = await loadStripe(publishableKey)

  const style = {
    base: {
      'color': '#32325d',
      'lineHeight': '18px',
      'fontFamily': '"Helvetica Neue", Helvetica, sans-serif',
      'fontSmoothing': 'antialiased',
      'fontSize': '16px',
      '::placeholder': {
        color: '#aab7c4',
      },
    },
    invalid: {
      color: '#fa755a',
      iconColor: '#fa755a',
    },
  }

  const elements = client.value.elements()
  const cardElement = elements.create('card', { style })

  cardElement.mount('#card-element')

  return cardElement
}

export async function loadPaymentElement(clientSecret: string): Promise<any> {
  client.value = await loadStripe(publishableKey)

  const elements = client.value.elements()
  const cardElement = elements.create('payment')

  cardElement.mount('#payment-element')

  elements.value = client.value.elements({ clientSecret })

  const paymentElement = elements.value.create('payment', {
    fields: { billingDetails: 'auto' },
  })

  paymentElement.mount('#payment-element')

  return cardElement
}

export async function confirmCardSetup(card: PaymentParam): Promise<{ setupIntent: any, error: any }> {
  const data = await client.value.confirmCardSetup(card.clientSecret, { payment_method: card.paymentMethod })

  const { setupIntent, error } = data

  return { setupIntent, error }
}
