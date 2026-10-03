import type { OrderStatus } from '../orders/events'
import type { CatalogSourceName, CatalogWarning, FetchLike } from './types'

/**
 * The normalized customers and orders the credentialed import maps into
 * (stacksjs/stacks#2853).
 *
 * The catalog import reads public storefront APIs. Customers and orders are
 * only on each platform's admin API, behind credentials: a Shopify Admin API
 * access token, WooCommerce REST API consumer keys, or a Shopware Admin API
 * integration. Each source is an adapter that maps its own payloads into these
 * records in pure functions, so the writer never sees a platform's shape and
 * every mapping is testable from recorded JSON.
 *
 * Money is integer minor units of the record's own currency throughout.
 * Nothing here has a field for a password hash or payment card data, and no
 * adapter requests one: what is not mapped cannot be written.
 */

/** A customer as every source maps it. */
export interface AccountCustomer {
  source: CatalogSourceName
  /** The source's own customer id, or null for a guest known only by email. */
  externalId: string | null
  /** Trimmed and lowercased; the deduplication key. Always a valid address. */
  email: string
  /** Display name. Falls back to the email when the source has no name. */
  name: string
  phone: string | null
  /** False when the source says the account is disabled; null when it does not say. */
  active: boolean | null
  /** Lifetime spend as the source reports it, in minor units of `currency`; null when not reported. */
  totalSpentMinor: number | null
  currency: string | null
  /** ISO 8601 timestamp of the customer's latest order, when the source reports it. */
  lastOrderAt: string | null
  /** An https avatar URL from the source (WooCommerce's Gravatar link), when there is one. */
  avatarUrl: string | null
  /** ISO 8601 timestamp the source created the customer. */
  createdAt: string | null
}

/** Who placed an order, as the order itself records it. */
export interface AccountOrderCustomer {
  externalId: string | null
  /** Trimmed and lowercased, or null when the order carries no valid email. */
  email: string | null
  name: string | null
  phone: string | null
}

/** One purchased line of an order. */
export interface AccountOrderLine {
  externalId: string
  /** The catalog product id the line references (the catalog import's `product` identity). */
  productExternalId: string | null
  /** The catalog variant id the line references (the catalog import's `variant` identity). */
  variantExternalId: string | null
  /** The line's label at the time of sale, e.g. `Organic Cotton Tee - S / Black`. */
  name: string
  sku: string | null
  quantity: number
  /** One unit, in minor units of the order's currency, before order-level discounts. */
  unitPriceMinor: number
}

export interface AccountOrder {
  source: CatalogSourceName
  externalId: string
  /** The number the merchant and customer know the order by (`#1001`). */
  number: string | null
  /** ISO 4217. Every amount below is in minor units of it. */
  currency: string
  status: OrderStatus
  /** The source's own status words, for the report and the unmapped warning. */
  sourceStatus: string
  totalMinor: number
  taxMinor: number
  discountMinor: number
  shippingMinor: number
  tipMinor: number
  customer: AccountOrderCustomer | null
  /** The shipping address on one line, or null when nothing ships. */
  shippingAddress: string | null
  /** The customer's note on the order. */
  note: string | null
  /** ISO 8601 timestamp the order was placed. */
  placedAt: string | null
  lines: AccountOrderLine[]
}

/** A source payload mapped to a record (or skipped), with what the mapping noticed. */
export interface MappedAccountRecord<T> {
  /** Null when the payload cannot be imported; `warnings` says why. */
  record: T | null
  warnings: CatalogWarning[]
}

/** One page of a source's customers or orders, already normalized. */
export interface AccountPage<T> {
  url: string
  items: T[]
  warnings: CatalogWarning[]
}

/** Credentials for one source. Read from env only, never from a flag. */
export type AccountCredentials =
  | { source: 'shopify', accessToken: string }
  | { source: 'woocommerce', consumerKey: string, consumerSecret: string }
  | { source: 'shopware', clientId: string, clientSecret: string }

export interface AccountFetchOptions {
  credentials: AccountCredentials
  /** Stop after this many records in total. */
  limit?: number
  fetch?: FetchLike
  /** ISO 4217 code for an order whose payload names no currency. */
  currency?: string
  /** Where the admin API lives when it differs from the store URL (Shopify's `.myshopify.com` address). */
  adminUrl?: string
  /** Injected wait, so rate-limit tests do not sleep. */
  sleep?: (ms: number) => Promise<void>
}

/**
 * A source of customers and orders. Implement this to add a platform: map its
 * payloads in pure functions, and page through its admin API here.
 */
export interface AccountAdapter {
  name: CatalogSourceName
  customers: (storeUrl: string, options: AccountFetchOptions) => AsyncIterable<AccountPage<AccountCustomer>>
  orders: (storeUrl: string, options: AccountFetchOptions) => AsyncIterable<AccountPage<AccountOrder>>
}
