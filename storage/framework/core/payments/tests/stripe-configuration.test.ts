import { describe, expect, it } from 'bun:test'
import { services } from '@stacksjs/config'
import { isStripeConfigured } from '../src/drivers/stripe'

describe('Stripe configuration', () => {
  it('reports whether a secret key is available without constructing a client', () => {
    const original = services.stripe?.secretKey
    if (!services.stripe)
      throw new Error('Stripe service configuration is missing')

    try {
      services.stripe.secretKey = ''
      expect(isStripeConfigured()).toBe(false)

      services.stripe.secretKey = '   '
      expect(isStripeConfigured()).toBe(false)

      services.stripe.secretKey = 'sk_test_configured'
      expect(isStripeConfigured()).toBe(true)
    }
    finally {
      services.stripe.secretKey = original
    }
  })
})
