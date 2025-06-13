import { services } from '@stacksjs/config'
import Stripe from 'stripe'

const apiKey = services?.stripe?.secretKey || 'abcd'

export const stripe: Stripe = new Stripe(apiKey, {
  apiVersion: '2025-02-24.acacia',
})
