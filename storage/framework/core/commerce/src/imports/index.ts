import type { AccountAdapter } from './account-types'
import type { CatalogAdapter } from './types'
import { shopifyAdapter } from './shopify'
import { shopifyAccountAdapter } from './shopify-admin'
import { shopwareAdapter } from './shopware'
import { shopwareAccountAdapter } from './shopware-admin'
import { wooCommerceAdapter } from './woocommerce'
import { wooCommerceAccountAdapter } from './woocommerce-admin'

/**
 * Catalog import from other commerce platforms (stacksjs/stacks#1319, #1320,
 * #1321).
 *
 * Catalog only, from each platform's public storefront API: no credentials
 * (Shopware's Store API wants its public sales channel access key), and
 * therefore no customers or orders. Run it with
 * `buddy commerce:import <store-url> --from shopify|woocommerce|shopware`.
 *
 * Adding a platform means writing a `CatalogAdapter` (a pure payload mapper
 * plus a pager) and registering it in `catalogAdapters`.
 *
 * Customers and orders (stacksjs/stacks#2853) come from each platform's admin
 * API instead, with credentials read from env only (`credentials.ts`):
 * `buddy commerce:import <store-url> --from <platform> --customers --orders`.
 * Those adapters are `AccountAdapter`s, registered in `accountAdapters`, and
 * written by `importCustomers` / `importOrders` (`account-writer.ts`).
 */

export const catalogAdapters: Readonly<Record<string, CatalogAdapter>> = {
  shopify: shopifyAdapter,
  woocommerce: wooCommerceAdapter,
  shopware: shopwareAdapter,
}

/** The adapter registered under `name`, case-insensitively. */
export function catalogAdapter(name: string): CatalogAdapter | undefined {
  return catalogAdapters[name.trim().toLowerCase()]
}

export const accountAdapters: Readonly<Record<string, AccountAdapter>> = {
  shopify: shopifyAccountAdapter,
  woocommerce: wooCommerceAccountAdapter,
  shopware: shopwareAccountAdapter,
}

/** The customer and order adapter registered under `name`, case-insensitively. */
export function accountAdapter(name: string): AccountAdapter | undefined {
  return accountAdapters[name.trim().toLowerCase()]
}

export * from './account-mapping'
export type {
  AccountAdapter,
  AccountCredentials,
  AccountCustomer,
  AccountFetchOptions,
  AccountOrder,
  AccountOrderCustomer,
  AccountOrderLine,
  AccountPage,
  MappedAccountRecord,
} from './account-types'
export * from './account-writer'
export * from './admin-http'
export * from './credentials'

export * from './http'
export * from './identity'
export * from './money'
export * from './shopify'
export * from './shopify-admin'
export * from './shopware'
export * from './shopware-admin'
export * from './text'
export type {
  CatalogAdapter,
  CatalogCategory,
  CatalogFetchOptions,
  CatalogImage,
  CatalogPage,
  CatalogProduct,
  CatalogSourceName,
  CatalogVariant,
  CatalogWarning,
  FetchLike,
  MappedProduct,
} from './types'
export * from './woocommerce'
export * from './woocommerce-admin'
export * from './writer'
