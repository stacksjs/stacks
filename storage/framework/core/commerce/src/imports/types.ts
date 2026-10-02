/**
 * The normalized catalog every import source maps into.
 *
 * Each source (Shopify, WooCommerce, and whatever comes next) is an adapter
 * that turns its own payloads into these records. The writer only ever sees
 * this shape, so adding a source never touches the code that talks to the
 * database, and the mapping is testable from recorded JSON with no I/O.
 *
 * Money is integer minor units of `currency` throughout. A source that hands
 * out decimal strings converts at its own boundary (see `money.ts`).
 */

/** A source registered with the importer. */
export type CatalogSourceName = 'shopify' | 'woocommerce' | (string & {})

export interface CatalogImage {
  /** Absolute URL on the source's CDN. Never downloaded by the importer. */
  src: string
  alt: string | null
}

export interface CatalogCategory {
  name: string
  slug: string
}

export interface CatalogVariant {
  /** The source's own id for the variant, stable across runs. */
  externalId: string
  /** Human label, e.g. `Small / Red`. */
  title: string
  sku: string | null
  /** Integer minor units of the product's currency, or null when unpriced. */
  priceMinor: number | null
  compareAtMinor: number | null
  available: boolean
  /** Units in stock when the source exposes it, else null (unknown). */
  inventory: number | null
  /** Option values in the order of `CatalogProduct.optionNames`. */
  optionValues: string[]
}

export interface CatalogProduct {
  source: CatalogSourceName
  /** The source's own id for the product, stable across runs. */
  externalId: string
  name: string
  /** URL handle on the source store (Shopify `handle`, Woo `slug`). */
  handle: string
  /** Product description as HTML, exactly as the source stores it. */
  descriptionHtml: string | null
  /** Brand or vendor, mapped onto a Manufacturer. */
  vendor: string | null
  /** First entry becomes the product's Category; the rest are reported only. */
  categories: CatalogCategory[]
  tags: string[]
  /** ISO 4217 code, or null when the source did not say. */
  currency: string | null
  images: CatalogImage[]
  /** Option axis names, e.g. `['Size', 'Color']`. Empty for a simple product. */
  optionNames: string[]
  /**
   * Every purchasable variant. A product with no options still carries one
   * variant (its own price and SKU); `hasOptions` says whether the variants
   * are real choices worth writing as ProductVariant rows.
   */
  variants: CatalogVariant[]
  hasOptions: boolean
  /** Public product page on the source store, for the operator's report. */
  url: string | null
}

/** A non-fatal problem found while mapping or fetching. */
export interface CatalogWarning {
  externalId?: string
  message: string
}

/** A source payload mapped to a product, with what the mapping noticed. */
export interface MappedProduct {
  product: CatalogProduct
  warnings: CatalogWarning[]
}

/** One page of a source's catalog, already normalized. */
export interface CatalogPage {
  /** The URL that produced this page, for error messages and the report. */
  url: string
  products: CatalogProduct[]
  warnings: CatalogWarning[]
}

/** `fetch`, narrowed to what the importer uses, so tests can inject one. */
export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>

export interface CatalogFetchOptions {
  /** Stop after this many products in total. */
  limit?: number
  fetch?: FetchLike
  /** ISO 4217 override when the source does not report its currency. */
  currency?: string
}

/**
 * A source of catalog data. Implement this to add a platform: map its payload
 * to `CatalogProduct` in a pure function, and page through it here.
 */
export interface CatalogAdapter {
  name: CatalogSourceName
  /** Pages of normalized products from the store at `storeUrl`. */
  pages: (storeUrl: string, options?: CatalogFetchOptions) => AsyncIterable<CatalogPage>
}
