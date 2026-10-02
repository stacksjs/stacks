import type { CatalogAdapter, CatalogFetchOptions, CatalogPage, CatalogProduct, CatalogVariant, CatalogWarning, FetchLike, MappedProduct } from './types'
import { slug } from '@stacksjs/strings'
import { CatalogFetchError, fetchJson, normalizeStoreUrl } from './http'
import { currencyExponent, PriceFormatError, rescaleMinor } from './money'
import { cleanName, optionalString } from './text'

/**
 * WooCommerce, through the unauthenticated Store API (`/wp-json/wc/store/v1`).
 *
 * The Store API is what the block-based cart and checkout use, so every
 * WooCommerce 6+ store serves it publicly. It carries the visible catalog:
 * names, slugs, HTML descriptions, categories, tags, brands (Woo 9.6+),
 * images, prices and stock status. It does not carry exact stock counts (only
 * `low_stock_remaining` once a product runs low), customers or orders; those
 * need the REST API v3 with consumer keys.
 *
 * Variable products list their variation ids but not their prices, so each
 * page of parents is followed by one request for that page's variations.
 */

const PAGE_SIZE = 100
const MAX_PAGES = 1000
const API_PATH = '/wp-json/wc/store/v1/products'
const HINT = 'Is WooCommerce 6+ installed with the Store API reachable at /wp-json?'

export interface WooPricesPayload {
  price?: string | null
  regular_price?: string | null
  sale_price?: string | null
  currency_code?: string | null
  currency_minor_unit?: number | string | null
}

export interface WooTermPayload {
  id?: number
  name?: string | null
  slug?: string | null
}

export interface WooAttributePayload {
  id?: number
  name?: string | null
  taxonomy?: string | null
  has_variations?: boolean
  terms?: WooTermPayload[] | null
}

export interface WooProductPayload {
  id: number | string
  name?: string | null
  slug?: string | null
  type?: string | null
  parent?: number | null
  permalink?: string | null
  sku?: string | null
  description?: string | null
  short_description?: string | null
  prices?: WooPricesPayload | null
  images?: Array<{ src?: string | null, alt?: string | null }> | null
  categories?: WooTermPayload[] | null
  tags?: WooTermPayload[] | null
  brands?: WooTermPayload[] | null
  attributes?: WooAttributePayload[] | null
  variations?: Array<{ id: number | string, attributes?: Array<{ name?: string | null, value?: string | null }> | null }> | null
  is_in_stock?: boolean | null
  is_purchasable?: boolean | null
  low_stock_remaining?: number | null
}

export interface WooMapContext {
  /** Store API records for this product's variations, keyed by id. */
  variations?: Map<string, WooProductPayload>
}

interface Prices {
  currency: string | null
  priceMinor: number | null
  compareAtMinor: number | null
}

/**
 * Store API prices as minor units of the currency's ISO precision.
 *
 * `prices.price` is already an integer, but at the STORE's configured decimals
 * (`currency_minor_unit`), which a merchant can set to anything. A sale price
 * makes the regular price the compare-at price.
 */
export function wooPrices(prices: WooPricesPayload | null | undefined): Prices {
  const currency = optionalString(prices?.currency_code)?.toUpperCase() ?? null
  const declared = Number(prices?.currency_minor_unit)
  const fromExponent = Number.isInteger(declared) && declared >= 0 ? declared : 2
  const toExponent = currencyExponent(currency)

  const priceMinor = rescaleMinor(prices?.price, fromExponent, toExponent)
  const regularMinor = rescaleMinor(prices?.regular_price, fromExponent, toExponent)

  return {
    currency,
    priceMinor,
    compareAtMinor: regularMinor !== null && priceMinor !== null && regularMinor > priceMinor ? regularMinor : null,
  }
}

function safePrices(payload: WooProductPayload, externalId: string, warnings: CatalogWarning[]): Prices {
  try {
    return wooPrices(payload.prices)
  }
  catch (error) {
    if (!(error instanceof PriceFormatError))
      throw error
    warnings.push({ externalId, message: `${error.message}; left unpriced` })
    return { currency: optionalString(payload.prices?.currency_code)?.toUpperCase() ?? null, priceMinor: null, compareAtMinor: null }
  }
}

function terms(list: WooTermPayload[] | null | undefined): Array<{ name: string, slug: string }> {
  return (list ?? [])
    .map((term) => {
      const name = cleanName(term?.name)
      return { name, slug: optionalString(term?.slug) ?? slug(name) }
    })
    .filter(term => term.name && term.slug)
}

function inventoryOf(payload: WooProductPayload): number | null {
  return typeof payload.low_stock_remaining === 'number' ? Math.max(0, Math.trunc(payload.low_stock_remaining)) : null
}

function availableOf(payload: WooProductPayload): boolean {
  return payload.is_in_stock !== false && payload.is_purchasable !== false
}

/** One Store API product, plus its fetched variations, as a catalog product. Pure. */
export function mapWooProduct(raw: WooProductPayload, context: WooMapContext = {}): MappedProduct {
  if (raw?.id === undefined || raw.id === null || raw.id === '')
    throw new TypeError('WooCommerce product has no id')

  const externalId = String(raw.id)
  const warnings: CatalogWarning[] = []
  const name = cleanName(raw.name)
  if (!name)
    throw new TypeError(`WooCommerce product ${externalId} has no name`)

  const own = safePrices(raw, externalId, warnings)
  const variable = raw.type === 'variable' && (raw.variations?.length ?? 0) > 0

  const optionAttributes = variable ? (raw.attributes ?? []).filter(attribute => attribute.has_variations !== false) : []
  const optionNames = optionAttributes.map(attribute => cleanName(attribute.name)).filter(Boolean)

  let variants: CatalogVariant[]
  let currency = own.currency

  if (variable) {
    variants = (raw.variations ?? []).map((entry) => {
      const variationId = String(entry.id)

      // The parent lists attribute values as term slugs ("blue"); show the
      // term's own name ("Blue"). An empty value is WooCommerce for "any".
      const optionValues = optionAttributes.map((attribute) => {
        const label = cleanName(attribute.name).toLowerCase()
        const taxonomy = (attribute.taxonomy ?? '').toLowerCase()
        const picked = (entry.attributes ?? []).find((value) => {
          const key = cleanName(value.name).toLowerCase()
          return key === label || (taxonomy !== '' && key === taxonomy)
        })
        const value = optionalString(picked?.value)
        if (!value)
          return 'Any'
        const term = (attribute.terms ?? []).find(candidate => candidate.slug === value)
        return term ? cleanName(term.name) : cleanName(value)
      })

      const detail = context.variations?.get(variationId)
      if (!detail) {
        warnings.push({ externalId, message: `variation ${variationId} could not be fetched; imported without a price` })
        return {
          externalId: variationId,
          title: optionValues.join(' / ') || name,
          sku: null,
          priceMinor: null,
          compareAtMinor: null,
          available: false,
          inventory: null,
          optionValues,
        }
      }

      const prices = safePrices(detail, variationId, warnings)
      currency ??= prices.currency
      return {
        externalId: variationId,
        title: optionValues.join(' / ') || cleanName(detail.name) || name,
        sku: optionalString(detail.sku),
        priceMinor: prices.priceMinor,
        compareAtMinor: prices.compareAtMinor,
        available: availableOf(detail),
        inventory: inventoryOf(detail),
        optionValues,
      }
    })
  }
  else {
    // Simple, external and grouped products are their own single variant.
    variants = [{
      externalId,
      title: name,
      sku: optionalString(raw.sku),
      priceMinor: own.priceMinor,
      compareAtMinor: own.compareAtMinor,
      available: availableOf(raw),
      inventory: inventoryOf(raw),
      optionValues: [],
    }]
  }

  const brand = terms(raw.brands)[0]

  return {
    product: {
      source: 'woocommerce',
      externalId,
      name,
      handle: optionalString(raw.slug) ?? slug(name),
      descriptionHtml: optionalString(raw.description) ?? optionalString(raw.short_description),
      vendor: brand ? brand.name : null,
      categories: terms(raw.categories),
      tags: terms(raw.tags).map(tag => tag.name),
      currency,
      images: (raw.images ?? [])
        .filter(image => optionalString(image?.src))
        .map(image => ({ src: optionalString(image.src)!, alt: optionalString(image.alt) })),
      optionNames: variable ? optionNames : [],
      variants,
      hasOptions: variable,
      url: optionalString(raw.permalink),
    },
    warnings,
  }
}

interface ListPage {
  url: string
  items: WooProductPayload[]
  totalPages: number | null
}

async function listPage(url: string, fetcher: FetchLike): Promise<ListPage> {
  const { data, headers } = await fetchJson<unknown>(url, fetcher, HINT)
  if (!Array.isArray(data))
    throw new CatalogFetchError(url, `${url} did not return a product list. ${HINT}`)

  // `Number(null)` is 0, which would read a missing header as "no pages".
  const header = headers.get('x-wp-totalpages')?.trim()
  const total = header ? Number(header) : Number.NaN
  return { url, items: data as WooProductPayload[], totalPages: Number.isInteger(total) && total >= 0 ? total : null }
}

/** Every variation of the given parents, keyed by variation id. */
async function fetchVariations(base: string, parentIds: string[], fetcher: FetchLike): Promise<Map<string, WooProductPayload>> {
  const found = new Map<string, WooProductPayload>()
  if (parentIds.length === 0)
    return found

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${base}${API_PATH}?type=variation&parent=${parentIds.join(',')}&per_page=${PAGE_SIZE}&page=${page}`
    const result = await listPage(url, fetcher)
    for (const item of result.items)
      found.set(String(item.id), item)

    if (result.items.length === 0 || (result.totalPages !== null && page >= result.totalPages))
      break
  }

  return found
}

async function* wooPages(storeUrl: string, options: CatalogFetchOptions = {}): AsyncGenerator<CatalogPage> {
  const base = normalizeStoreUrl(storeUrl)
  const fetcher = options.fetch ?? fetch
  const limit = options.limit
  const pageSize = limit && limit > 0 ? Math.min(PAGE_SIZE, limit) : PAGE_SIZE
  const seen = new Set<string>()
  let emitted = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${base}${API_PATH}?per_page=${pageSize}&page=${page}`
    const result = await listPage(url, fetcher)
    if (result.items.length === 0)
      return

    const ids = result.items.map(item => String(item?.id))
    if (page > 1 && ids.every(id => seen.has(id)))
      throw new CatalogFetchError(url, `${url} repeated products from an earlier page; the store is not paginating. Use --limit to import the first page only.`)
    ids.forEach(id => seen.add(id))

    const take = limit ? result.items.slice(0, Math.max(0, limit - emitted)) : result.items
    const warnings: CatalogWarning[] = []

    const parents = take.filter(item => item?.type === 'variable' && (item.variations?.length ?? 0) > 0).map(item => String(item.id))
    let variations = new Map<string, WooProductPayload>()
    try {
      variations = await fetchVariations(base, parents, fetcher)
    }
    catch (error) {
      // A store that rejects the variation query still has a catalog worth
      // importing; its variants arrive unpriced and the report says why.
      if (!(error instanceof CatalogFetchError))
        throw error
      warnings.push({ message: `variations could not be fetched (${error.message}); variable products are imported without variant prices` })
    }

    const products: CatalogProduct[] = []
    for (const entry of take) {
      try {
        const mapped = mapWooProduct(entry, { variations })
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
    if (result.totalPages !== null && page >= result.totalPages)
      return
  }

  throw new CatalogFetchError(base, `Stopped after ${MAX_PAGES} pages of ${base}${API_PATH} without reaching the end.`)
}

export const wooCommerceAdapter: CatalogAdapter = {
  name: 'woocommerce',
  pages: wooPages,
}
