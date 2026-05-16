import type { CommerceConfig } from '@stacksjs/types'

/**
 * **Commerce Configuration**
 *
 * Controls the commerce feature bundle (Order, Cart, Product, Customer,
 * Coupon, GiftCard, Receipt, Shipping models + storefront API). Flip
 * `enabled` to `false` to leave the bundle inert at boot. Manage via
 * `./buddy commerce:install` / `./buddy commerce:uninstall` rather than
 * editing this file by hand.
 */
export default {
  enabled: true,

  /** Default storefront currency (ISO 4217). */
  currency: 'USD',

  /** Default tax rate applied when a product/region rule doesn't override. */
  defaultTaxRate: 0,
} satisfies CommerceConfig
