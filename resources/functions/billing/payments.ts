import { loadStripe } from '@stripe/stripe-js'

export const publishableKey = import.meta.env.FRONTEND_STRIPE_PUBLIC_KEY
const paymentStore = usePaymentStore()

const stripe = ref(null as any)

export function useBillable() {
  function convertUnixTimestampToDate(timestamp: number): string {
    // Create a Date object from the Unix timestamp
    const date = new Date(timestamp * 1000) // Multiply by 1000 to convert to milliseconds

    // Define arrays for month names
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ]

    // Extract day, month, and year
    const day = date.getDate()
    const month = monthNames[date.getMonth()]
    const year = date.getFullYear()

    // Return the formatted string in "Month Day, Year" format
    return `${month} ${day}, ${year}`
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
    }
  }

  function isEmpty(object: any) {
    return !object // Checks for null or undefined
      || (typeof object === 'object'
        && Object.keys(object).length === 0)
  }

  return { loadStripeElement, handleAddPaymentMethod, isEmpty, convertUnixTimestampToDate }
}
