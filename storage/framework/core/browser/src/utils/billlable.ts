import { loadStripe } from '@stripe/stripe-js'
import { ref } from 'vue'

export const publishableKey: string = import.meta.env.FRONTEND_STRIPE_PUBLIC_KEY || ''

const client = ref(null as any)


export async function cardElement(): Promise<any> {
  client.value = await loadStripe(publishableKey)

  const elements = client.value.elements()
  const cardElement = elements.create('card')

  cardElement.mount('#payment-element')

  return cardElement
}