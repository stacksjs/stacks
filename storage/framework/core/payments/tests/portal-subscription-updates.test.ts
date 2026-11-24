import type { SaasPortal } from '@stacksjs/types'
import type Stripe from 'stripe'
import { expect, test } from 'bun:test'
import { portalConfigurationMatches, portalConfigurationParams } from '../src/billable/portal'

const portal: SaasPortal = {
  subscriptionUpdate: {
    allowedUpdates: ['price', 'quantity'],
    prorationBehavior: 'always_invoice',
    products: [
      { product: 'prod_mail', prices: ['price_monthly', 'price_yearly'], adjustableQuantity: { minimum: 1, maximum: 20 } },
      { product: 'prod_other', prices: ['price_other'] },
    ],
  },
}

function existingPortal(): Stripe.BillingPortal.Configuration {
  return {
    id: 'bpc_fixture',
    default_return_url: null,
    business_profile: { headline: null },
    features: {
      customer_update: { enabled: true },
      invoice_history: { enabled: true },
      payment_method_update: { enabled: true },
      subscription_cancel: { enabled: true, mode: 'at_period_end' },
      subscription_update: {
        enabled: true,
        default_allowed_updates: ['quantity', 'price'],
        proration_behavior: 'always_invoice',
        products: [
          { product: 'prod_other', prices: ['price_other'], adjustable_quantity: { enabled: false, minimum: null, maximum: null } },
          { product: 'prod_mail', prices: ['price_yearly', 'price_monthly'], adjustable_quantity: { enabled: true, minimum: 1, maximum: 20 } },
        ],
      },
    },
  } as unknown as Stripe.BillingPortal.Configuration
}

test('the Stripe portal restricts subscription changes to configured products, prices, and seat ranges', () => {
  expect(portalConfigurationParams(portal).features.subscription_update).toEqual({
    enabled: true,
    default_allowed_updates: ['price', 'quantity'],
    proration_behavior: 'always_invoice',
    products: [
      { product: 'prod_mail', prices: ['price_monthly', 'price_yearly'], adjustable_quantity: { enabled: true, minimum: 1, maximum: 20 } },
      { product: 'prod_other', prices: ['price_other'], adjustable_quantity: { enabled: false } },
    ],
  })
})

test('a subsequent Stripe setup keeps matching settings and detects subscription-update drift', () => {
  const params = portalConfigurationParams(portal)
  expect(portalConfigurationMatches(existingPortal(), params)).toBe(true)

  const priceDrift = existingPortal()
  priceDrift.features.subscription_update.products![1]!.prices.push('price_unapproved')
  expect(portalConfigurationMatches(priceDrift, params)).toBe(false)

  const seatDrift = existingPortal()
  seatDrift.features.subscription_update.products![1]!.adjustable_quantity.maximum = 40
  expect(portalConfigurationMatches(seatDrift, params)).toBe(false)

  const prorationDrift = existingPortal()
  prorationDrift.features.subscription_update.proration_behavior = 'none'
  expect(portalConfigurationMatches(prorationDrift, params)).toBe(false)
})

test('omitting subscription settings hands control to Stripe and false disables the feature', () => {
  const unmanaged = portalConfigurationParams({})
  expect(unmanaged.features.subscription_update).toBeUndefined()
  expect(portalConfigurationMatches(existingPortal(), unmanaged)).toBe(true)

  const disabled = portalConfigurationParams({ subscriptionUpdate: false })
  expect(disabled.features.subscription_update).toEqual({ enabled: false })
  const existing = existingPortal()
  expect(portalConfigurationMatches(existing, disabled)).toBe(false)
  existing.features.subscription_update.enabled = false
  expect(portalConfigurationMatches(existing, disabled)).toBe(true)
})
