import { loadStripe } from '@stripe/stripe-js'
import { ref } from 'vue'

interface PaymentMethod {
  card: any; // Replace `any` with the appropriate type for `elements`
  billing_details: {
    name: string;
  };
}

interface PaymentParam {
  clientSecret: string;
  payment_method: PaymentMethod;
}

export const publishableKey: string = import.meta.env.FRONTEND_STRIPE_PUBLIC_KEY || ''

const client = ref(null as any)

export async function loadCardElement(clientSecret: string): Promise<boolean> {
  client.value = await loadStripe(publishableKey)

  const elements = client.value.elements()
  const cardElement = elements.create('card')

  cardElement.mount('#payment-element')

  if (client) {
    elements.value = client.value.elements({ clientSecret })

    const paymentElement = elements.value.create('payment', {
      fields: { billingDetails: 'auto' },
    })

    paymentElement.mount('#payment-element')

    return true
  }

  return false
}

export async function confirmCardSetup(card: PaymentParam): Promise<{ setupIntent: any, error: any }> {
  const clientSecret = card.clientSecret

  const { setupIntent, error } = await client.value.confirmCardSetup(card)

  return { setupIntent, error }
}