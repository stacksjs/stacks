import { services } from '@stacksjs/config'
import Stripe from 'stripe'

const apiKey = services?.stripe?.secretKey
if (!apiKey) {
  throw new Error('Stripe secret key is not configured. Set STRIPE_SECRET_KEY in your .env file.')
}

export const stripe: Stripe = new Stripe(apiKey, {
  apiVersion: '2026-02-25.clover',
})
