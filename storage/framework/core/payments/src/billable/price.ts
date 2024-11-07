import type Stripe from 'stripe'
import { cache } from '@stacksjs/cache'
import { stripe } from '..'
import { price } from '../drivers/stripe'

export interface PriceManager {
  retrieveByLookupKey: (lookupKey: string) => Promise<Stripe.Price | undefined>
  createOrGet: (lookupKey: string, params: Stripe.PriceCreateParams) => Promise<Stripe.Price>
}

export const managePrice: PriceManager = (() => {
  async function retrieveByLookupKey(lookupKey: string): Promise<Stripe.Price | undefined> {
    const cachedPrice = cache.get(`price_${lookupKey}`)

    if (cachedPrice) {
      try {
        // If cached value is a string, parse it; otherwise, it's already a parsed object
        return typeof cachedPrice === 'string' ? JSON.parse(cachedPrice) : cachedPrice
      }
      catch (error) {
        console.error('Error parsing cached price:', error)
      }
    }

    try {
      const prices = await stripe.price.list({ lookup_keys: [lookupKey] })

      if (!prices.data.length)
        return undefined

      const price = prices.data[0]
      cache.set(`price_${lookupKey}`, JSON.stringify(price))

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

    const newPrice = await stripe.price.create({
      ...params,
      lookup_key: lookupKey,
    })

    return newPrice
  }

  return { retrieveByLookupKey, createOrGet }
})()
