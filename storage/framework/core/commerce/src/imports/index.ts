import type { CatalogAdapter } from './types'
import { shopifyAdapter } from './shopify'
import { wooCommerceAdapter } from './woocommerce'

/**
 * Catalog import from other commerce platforms (stacksjs/stacks#1319, #1320).
 *
 * Catalog only, from each platform's public storefront API: no credentials,
 * and therefore no customers or orders. Run it with
 * `buddy commerce:import <store-url> --from shopify|woocommerce`.
 *
 * Adding a platform means writing a `CatalogAdapter` (a pure payload mapper
 * plus a pager) and registering it in `catalogAdapters`.
 */

export const catalogAdapters: Readonly<Record<string, CatalogAdapter>> = {
  shopify: shopifyAdapter,
  woocommerce: wooCommerceAdapter,
}

/** The adapter registered under `name`, case-insensitively. */
export function catalogAdapter(name: string): CatalogAdapter | undefined {
  return catalogAdapters[name.trim().toLowerCase()]
}

export * from './http'
export * from './identity'
export * from './money'
export * from './shopify'
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
export * from './writer'
