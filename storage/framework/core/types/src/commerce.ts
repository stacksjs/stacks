/**
 * **Commerce Options**
 *
 * Top-level feature gate plus storefront defaults. The commerce bundle
 * (Order / Cart / Product / Customer / Coupon / GiftCard / Shipping models +
 * storefront API) stays inert at boot when `enabled` is `false`.
 */
export interface CommerceOptions {
  enabled?: boolean
  /** Optional deploy-target gate, e.g. `['production']`. */
  env?: string[]
  /** Default storefront currency (ISO 4217), e.g. `'USD'`. */
  currency?: string
  /** Default tax rate applied when no product/region rule overrides. */
  defaultTaxRate?: number
}

export type CommerceConfig = Partial<CommerceOptions>
