const stacksConfig = (globalThis as any).__STACKS_CONFIG__ || {}
export const publishableKey: string = stacksConfig.FRONTEND_STRIPE_PUBLIC_KEY || ''

let client: any

// `@stripe/stripe-js` is an opt-in dependency, loaded lazily only when a
// Stripe card/payment element is actually mounted. Install it (`bun add
// @stripe/stripe-js`) when you enable Stripe payments in your config.
async function loadStripe(key: string): Promise<any> {
  let stripeJs: typeof import('@stripe/stripe-js')
  try {
    stripeJs = await import('@stripe/stripe-js')
  }
  catch {
    throw new Error(
      'Stripe is being used but the `@stripe/stripe-js` package is not installed. '
      + 'It is an opt-in dependency — run `bun add @stripe/stripe-js` to enable Stripe payments in the browser.',
    )
  }

  return stripeJs.loadStripe(key)
}

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
