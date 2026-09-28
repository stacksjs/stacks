export interface SaasOption {
  plans: {
    productName: string
    description: string
    pricing: {
      key: string
      price: number
      interval?: 'day' | 'month' | 'week' | 'year' // Optional interval
      currency: string
    }[]
    metadata: {
      createdBy: string
      version: string
    }
  }[]
  webhook: {
    endpoint: string
    secret: string
  }
  currencies: string[]
  /**
   * Discounts `buddy stripe:setup` creates, each with the codes customers type.
   *
   * A coupon is found again by `id` on every run, so re-running never makes a
   * second one. Stripe coupons cannot be edited once created, so changing the
   * discount means a new `id`.
   */
  coupons: SaasCoupon[]
  /**
   * The Stripe customer portal: where a customer manages a subscription,
   * payment method and invoices. `buddy stripe:setup` keeps one configuration
   * in the account to match this, and `Payment.billingPortal()` uses it.
   */
  portal?: SaasPortal
  products: {
    name: string
    description: string
    images: string[]
  }[]
}

export type SaasConfig = Partial<SaasOption>

export interface SaasCoupon {
  /** The Stripe coupon id. Stable: it is how a re-run finds the coupon. Defaults to `code`. */
  id?: string
  /** Shown to the customer at checkout and on invoices. */
  name?: string
  /** 1 to 100. Give this or `amountOff`. */
  percentOff?: number
  /** Minor units: 500 is $5.00. Needs `currency`. */
  amountOff?: number
  currency?: string
  duration: 'once' | 'repeating' | 'forever'
  /** With `repeating`: how many months of invoices the discount covers. */
  durationInMonths?: number
  maxRedemptions?: number
  /**
   * Only these products (by `productName` from `plans`). Omit for all.
   * Stripe restricts by product, not price, so a plan that must not get the
   * discount needs a product of its own.
   */
  appliesTo?: string[]
  /** The codes customers type. Each becomes a Stripe promotion code. */
  codes?: string[]
  /** @deprecated One code; use `codes`. */
  code?: string
}

export interface SaasPortal {
  /** Shown at the top of the portal. */
  headline?: string
  /** Where "Return to" goes when a session names no return URL. */
  returnUrl?: string
  privacyPolicyUrl?: string
  termsOfServiceUrl?: string
  /** Let customers cancel. `at_period_end` keeps what they paid for until it runs out. Default `at_period_end`. */
  cancel?: false | 'at_period_end' | 'immediately'
  /** Update the card on file. Default true. */
  paymentMethodUpdate?: boolean
  /** Download past invoices. Default true. */
  invoiceHistory?: boolean
  /** Change the email on the customer. Default true. */
  emailUpdate?: boolean
}
