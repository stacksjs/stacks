import type Stripe from 'stripe'
import { stripe } from '..'

export interface PriceManager {
  retrieveByLookupKey: (lookupKey: string) => Promise<Stripe.Price>
}

export const managePrice: PriceManager = (() => {
  async function retrieveByLookupKey(lookupKey: string): Promise<Stripe.Price> {
    const prices = await stripe.price.list({ lookup_keys: [lookupKey] })

    return prices.data[0]
  }

  return { retrieveByLookupKey }
})()
