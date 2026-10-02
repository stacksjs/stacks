import type { CatalogAdapter, CatalogFetchOptions, CatalogImage, CatalogPage, CatalogProduct, CatalogVariant, CatalogWarning, MappedProduct } from './types'
import { slug } from '@stacksjs/strings'
import { CatalogFetchError, fetchJson, normalizeStoreUrl } from './http'
import { currencyExponent, decimalToMinor, PriceFormatError } from './money'
import { optionalString } from './text'

/**
 * Shopify, through the storefront's public `products.json`.
 *
 * Every Online Store serves `/products.json` without credentials. It carries
 * the catalog (titles, handles, HTML descriptions, vendor, product type, tags,
 * variants with SKU and price, image URLs) and nothing private: no stock
 * levels, no cost, no customers, no orders. Those need the Admin API and an
 * access token, which is out of this importer's scope.
 *
 * A store behind a storefront password, or a headless store with the Online
 * Store channel disabled, answers 401/404 here and cannot be imported this way.
 */

const PAGE_SIZE = 250
/** 250 x 400 = 100k products; a store past that is not a store that loops. */
const MAX_PAGES = 400

export interface ShopifyVariantPayload {
  id: number | string
  title?: string | null
  sku?: string | null
  price?: string | number | null
  compare_at_price?: string | number | null
  available?: boolean | null
  inventory_quantity?: number | null
  option1?: string | null
  option2?: string | null
  option3?: string | null
}

export interface ShopifyImagePayload {
  src?: string | null
  position?: number | null
  alt?: string | null
}

export interface ShopifyProductPayload {
  id: number | string
  title?: string | null
  handle?: string | null
  body_html?: string | null
  vendor?: string | null
  product_type?: string | null
  tags?: string[] | string | null
  variants?: ShopifyVariantPayload[] | null
  images?: ShopifyImagePayload[] | null
  options?: Array<{ name?: string | null, values?: string[] | null }> | null
}

export interface ShopifyMapContext {
  storeUrl: string
  currency: string | null
}

/** The placeholder option Shopify gives a product that has no options. */
function isDefaultOptionSet(options: ShopifyProductPayload['options']): boolean {
  if (!options || options.length === 0)
    return true
  if (options.length !== 1)
    return false
  const [only] = options
  return only?.name === 'Title' && (only.values?.length ?? 0) <= 1 && (only.values?.[0] ?? 'Default Title') === 'Default Title'
}

function tagsOf(tags: ShopifyProductPayload['tags']): string[] {
  const list = Array.isArray(tags) ? tags : typeof tags === 'string' ? tags.split(',') : []
  return list.map(tag => String(tag).trim()).filter(Boolean)
}

function price(value: unknown, exponent: number, label: string, externalId: string, warnings: CatalogWarning[]): number | null {
  try {
    return decimalToMinor(value as string | number | null | undefined, exponent)
  }
  catch (error) {
    if (!(error instanceof PriceFormatError))
      throw error
    warnings.push({ externalId, message: `${label}: ${error.message}; left unpriced` })
    return null
  }
}

/** One `products.json` entry as a normalized catalog product. Pure. */
export function mapShopifyProduct(raw: ShopifyProductPayload, context: ShopifyMapContext): MappedProduct {
  if (raw?.id === undefined || raw.id === null || raw.id === '')
    throw new TypeError('Shopify product has no id')

  const externalId = String(raw.id)
  const warnings: CatalogWarning[] = []
  const name = (optionalString(raw.title) ?? '').replace(/\s+/g, ' ')
  if (!name)
    throw new TypeError(`Shopify product ${externalId} has no title`)

  const handle = optionalString(raw.handle) ?? slug(name)
  const exponent = currencyExponent(context.currency)
  const hasOptions = !isDefaultOptionSet(raw.options)
  const optionNames = hasOptions
    ? (raw.options ?? []).map(option => optionalString(option.name) ?? '').filter(Boolean)
    : []

  const variants: CatalogVariant[] = (raw.variants ?? []).map((variant) => {
    const variantId = String(variant.id)
    const compareAt = price(variant.compare_at_price, exponent, `variant ${variantId} compare-at price`, externalId, warnings)
    return {
      externalId: variantId,
      title: optionalString(variant.title) ?? name,
      sku: optionalString(variant.sku),
      priceMinor: price(variant.price, exponent, `variant ${variantId} price`, externalId, warnings),
      // Shopify reports "0.00" for "no compare-at price" on some stores.
      compareAtMinor: compareAt ? compareAt : null,
      available: variant.available !== false,
      inventory: typeof variant.inventory_quantity === 'number' ? Math.max(0, Math.trunc(variant.inventory_quantity)) : null,
      optionValues: hasOptions
        ? [variant.option1, variant.option2, variant.option3].slice(0, optionNames.length).map(value => optionalString(value) ?? '')
        : [],
    }
  })

  if (variants.length === 0)
    warnings.push({ externalId, message: `"${name}" has no variants; imported without a price` })

  const images: CatalogImage[] = [...(raw.images ?? [])]
    .filter(image => optionalString(image?.src))
    .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
    .map(image => ({ src: optionalString(image.src)!, alt: optionalString(image.alt) }))

  const productType = optionalString(raw.product_type)

  return {
    product: {
      source: 'shopify',
      externalId,
      name,
      handle,
      descriptionHtml: optionalString(raw.body_html),
      vendor: optionalString(raw.vendor),
      categories: productType ? [{ name: productType, slug: slug(productType) }] : [],
      tags: tagsOf(raw.tags),
      currency: context.currency,
      images,
      optionNames,
      variants,
      hasOptions,
      url: `${context.storeUrl}/products/${handle}`,
    },
    warnings,
  }
}

/** The shop's currency from `/meta.json`, or null if the store will not say. */
export async function detectShopifyCurrency(storeUrl: string, fetcher: CatalogFetchOptions['fetch'] = fetch): Promise<string | null> {
  try {
    const { data } = await fetchJson<{ currency?: unknown }>(`${storeUrl}/meta.json`, fetcher)
    const code = typeof data?.currency === 'string' ? data.currency.trim().toUpperCase() : ''
    return /^[A-Z]{3}$/.test(code) ? code : null
  }
  catch {
    return null
  }
}

async function* shopifyPages(storeUrl: string, options: CatalogFetchOptions = {}): AsyncGenerator<CatalogPage> {
  const base = normalizeStoreUrl(storeUrl)
  const fetcher = options.fetch ?? fetch
  const limit = options.limit
  const pageSize = limit && limit > 0 ? Math.min(PAGE_SIZE, limit) : PAGE_SIZE

  const setupWarnings: CatalogWarning[] = []
  let currency = options.currency?.toUpperCase() ?? null
  if (!currency) {
    currency = await detectShopifyCurrency(base, fetcher)
    if (!currency)
      setupWarnings.push({ message: `${base}/meta.json did not report a currency; prices read as 2-decimal amounts. Pass --currency to be sure.` })
  }

  const seen = new Set<string>()
  let emitted = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${base}/products.json?limit=${pageSize}&page=${page}`
    const { data } = await fetchJson<{ products?: unknown }>(url, fetcher, 'Is this a Shopify storefront, and is it public (no storefront password)?')

    if (!Array.isArray(data?.products))
      throw new CatalogFetchError(url, `${url} did not return a "products" list. Is this a Shopify storefront?`)

    const raw = data.products as ShopifyProductPayload[]
    if (raw.length === 0)
      return

    // A store that ignores `page` serves page 1 forever. Stop rather than loop.
    const ids = raw.map(product => String(product?.id))
    if (page > 1 && ids.every(id => seen.has(id)))
      throw new CatalogFetchError(url, `${url} repeated products from an earlier page; the store is not paginating. Use --limit to import the first page only.`)
    ids.forEach(id => seen.add(id))

    const products: CatalogProduct[] = []
    const warnings: CatalogWarning[] = page === 1 ? setupWarnings : []

    for (const entry of raw) {
      if (limit && emitted >= limit)
        break
      try {
        const mapped = mapShopifyProduct(entry, { storeUrl: base, currency })
        products.push(mapped.product)
        warnings.push(...mapped.warnings)
        emitted++
      }
      catch (error) {
        warnings.push({ externalId: entry?.id === undefined ? undefined : String(entry.id), message: `skipped: ${(error as Error).message}` })
      }
    }

    yield { url, products, warnings }

    if (limit && emitted >= limit)
      return
  }

  throw new CatalogFetchError(base, `Stopped after ${MAX_PAGES} pages of ${base}/products.json without reaching the end.`)
}

export const shopifyAdapter: CatalogAdapter = {
  name: 'shopify',
  pages: shopifyPages,
}
