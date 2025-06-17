import type Stripe from 'stripe'
import { stripe } from '..'

export interface PriceManager {
  retrieveByLookupKey: (lookupKey: string) => Promise<Stripe.Price | undefined>
  createOrGet: (lookupKey: string, params: Stripe.PriceCreateParams) => Promise<Stripe.Price>
}

export const managePrice: PriceManager = (() => {
  async function retrieveByLookupKey(lookupKey: string): Promise<Stripe.Price | undefined> {
    try {
      const prices = await stripe.prices.list({ lookup_keys: [lookupKey] })

      if (!prices.data.length)
        return undefined

      const price = prices.data[0]

      return price
    }
    catch (error) {
      console.error('Error retrieving price from Stripe:', error)
      return undefined
    }
  }

  async function createOrGet(
    lookupKey: string,
    params: Stripe.PriceCreateParams,
  ): Promise<Stripe.Price> {
    const existingPrice = await retrieveByLookupKey(lookupKey)

    if (existingPrice)
      return existingPrice

    const newPrice = await stripe.prices.create({
      ...params,
      lookup_key: lookupKey,
    })

    return newPrice
  }

  return { retrieveByLookupKey, createOrGet }
})()
