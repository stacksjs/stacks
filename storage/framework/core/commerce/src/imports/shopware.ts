import type { CatalogAdapter, CatalogCategory, CatalogFetchOptions, CatalogImage, CatalogPage, CatalogProduct, CatalogVariant, CatalogWarning, FetchLike, MappedProduct } from './types'
import { slug } from '@stacksjs/strings'
import { CatalogFetchError, fetchJson, normalizeStoreUrl } from './http'
import { currencyExponent, numberToMinor, PriceFormatError } from './money'
import { optionalString } from './text'

/**
 * Shopware 6, through the Store API (`/store-api`).
 *
 * The Store API is what every Shopware 6 storefront, headless or not, reads
 * its catalog from. It needs one header, `sw-access-key`: the sales channel's
 * access key. That key is public by design (it ships in every headless
 * storefront's page source and only selects which sales channel answers), so
 * reading with it is reading what an anonymous shopper sees: names, HTML
 * descriptions, manufacturer, categories, tags, media, gross prices in the
 * sales channel's currency, stock, and variants with their option values.
 * Customers and orders need the Admin API and an integration's credentials,
 * which is out of this importer's scope.
 *
 * Variants are separate products in Shopware, children of a parent through
 * `parentId`. Each page asks for parents only, then makes one request for that
 * page's children with their option groups, the same shape as the WooCommerce
 * adapter. The parent itself is never sold, so a parent with children maps to
 * those children; a product without children is its own single variant.
 *
 * Verified against the Store API OpenAPI schema (shopware/frontends
 * `storeApiSchema.json`) and Shopware's public demo sales channel.
 */

/** The Store API's default `shopware.api.store.max_limit`; a higher limit is a 400. */
const PAGE_SIZE = 100
const MAX_PAGES = 1000
const API_PREFIX = '/store-api'
const HINT = 'Is this a Shopware 6 store with the Store API reachable at /store-api?'

/** Where an operator finds the key, for every message that asks for it. */
export const SHOPWARE_ACCESS_KEY_HELP = 'Find it in the Shopware Administration under Sales Channels: open the storefront or headless sales channel and copy the key from its "API access" card. A headless storefront also ships it in its page source.'

export interface ShopwareNamedPayload {
  id?: string | null
  name?: string | null
  translated?: { name?: string | null } | unknown[] | null
}

export interface ShopwarePropertyGroupPayload extends ShopwareNamedPayload {
  position?: number | null
}

export interface ShopwareOptionPayload extends ShopwareNamedPayload {
  groupId?: string | null
  position?: number | null
  group?: ShopwarePropertyGroupPayload | null
}

export interface ShopwareMediaPayload {
  url?: string | null
  alt?: string | null
  title?: string | null
  translated?: { alt?: string | null, title?: string | null } | unknown[] | null
}

export interface ShopwareProductMediaPayload {
  position?: number | null
  media?: ShopwareMediaPayload | null
}

export interface ShopwareCalculatedPricePayload {
  /** Gross (or net, per the sales channel's tax display) for one unit, in the context currency. */
  unitPrice?: number | string | null
  quantity?: number | null
  /** The "was" price, when the product has one. */
  listPrice?: { price?: number | string | null } | null
}

export interface ShopwareProductPayload {
  id: string
  parentId?: string | null
  productNumber?: string | null
  name?: string | null
  description?: string | null
  translated?: { name?: string | null, description?: string | null } | unknown[] | null
  calculatedPrice?: ShopwareCalculatedPricePayload | null
  stock?: number | null
  availableStock?: number | null
  available?: boolean | null
  active?: boolean | null
  childCount?: number | null
  manufacturer?: ShopwareNamedPayload | null
  seoCategory?: ShopwareNamedPayload | null
  categories?: ShopwareNamedPayload[] | null
  tags?: Array<{ name?: string | null }> | null
  cover?: ShopwareProductMediaPayload | null
  media?: ShopwareProductMediaPayload[] | null
  options?: ShopwareOptionPayload[] | null
}

export interface ShopwareMapContext {
  storeUrl: string
  currency: string | null
  /** The parent's variants (child products), when it has any. */
  children?: ShopwareProductPayload[]
}

/**
 * `translated.<field>` (the value in the sales channel's language, with
 * inheritance from the parent already applied), else the entity's own field.
 * Shopware serializes an empty `translated` as `[]`, hence the object check.
 */
function translated(entity: object | null | undefined, field: string): string | null {
  if (!entity)
    return null
  const record = entity as Record<string, unknown>
  const bag = record.translated
  const own = bag && typeof bag === 'object' && !Array.isArray(bag) ? optionalString((bag as Record<string, unknown>)[field]) : null
  return own ?? optionalString(record[field])
}

function nameOf(entity: object | null | undefined): string | null {
  return translated(entity, 'name')?.replace(/\s+/g, ' ') ?? null
}

function stockOf(raw: ShopwareProductPayload): number | null {
  const value = typeof raw.availableStock === 'number' ? raw.availableStock : raw.stock
  // Shopware lets a product that is not a closeout oversell into negative stock.
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.trunc(value)) : null
}

function availableOf(raw: ShopwareProductPayload): boolean {
  return raw.available !== false && raw.active !== false
}

interface Prices {
  priceMinor: number | null
  compareAtMinor: number | null
}

/** `calculatedPrice` as integer minor units; a list price only counts when it is higher. */
function pricesOf(raw: ShopwareProductPayload, label: string, externalId: string, context: ShopwareMapContext, warnings: CatalogWarning[]): Prices {
  const exponent = currencyExponent(context.currency)
  const unit = raw.calculatedPrice?.unitPrice
  if (unit === null || unit === undefined || unit === '') {
    warnings.push({ externalId, message: `${label} has no price in ${context.currency ?? 'the sales channel currency'}; left unpriced` })
    return { priceMinor: null, compareAtMinor: null }
  }

  try {
    const priceMinor = numberToMinor(unit, exponent)
    const listMinor = numberToMinor(raw.calculatedPrice?.listPrice?.price ?? null, exponent)
    return {
      priceMinor,
      compareAtMinor: listMinor !== null && priceMinor !== null && listMinor > priceMinor ? listMinor : null,
    }
  }
  catch (error) {
    if (!(error instanceof PriceFormatError))
      throw error
    warnings.push({ externalId, message: `${label}: ${error.message}; left unpriced` })
    return { priceMinor: null, compareAtMinor: null }
  }
}

function imagesOf(raw: ShopwareProductPayload): CatalogImage[] {
  const entries = [...(raw.media ?? [])].sort((a, b) => (a?.position ?? 0) - (b?.position ?? 0))
  if (raw.cover)
    entries.unshift(raw.cover)

  const seen = new Set<string>()
  const images: CatalogImage[] = []
  for (const entry of entries) {
    const src = optionalString(entry?.media?.url)
    if (!src || seen.has(src))
      continue
    seen.add(src)
    const media = entry!.media
    images.push({ src, alt: translated(media, 'alt') ?? translated(media, 'title') })
  }
  return images
}

function categoriesOf(raw: ShopwareProductPayload): CatalogCategory[] {
  const seen = new Set<string>()
  const categories: CatalogCategory[] = []
  // The SEO category is the merchant's main one for this sales channel.
  for (const entry of [raw.seoCategory, ...(raw.categories ?? [])]) {
    const name = nameOf(entry)
    const key = name ? slug(name) : ''
    if (!name || !key || seen.has(key))
      continue
    seen.add(key)
    categories.push({ name, slug: key })
  }
  return categories
}

interface OptionAxis {
  key: string
  name: string
  position: number
  order: number
}

/** The option groups the children vary on, in the shop's group order. */
function optionAxes(children: ShopwareProductPayload[]): OptionAxis[] {
  const axes = new Map<string, OptionAxis>()
  for (const child of children) {
    for (const option of child.options ?? []) {
      const name = nameOf(option.group)
      const key = optionalString(option.groupId) ?? optionalString(option.group?.id) ?? name
      if (!key || !name || axes.has(key))
        continue
      axes.set(key, { key, name, position: option.group?.position ?? 0, order: axes.size })
    }
  }
  return [...axes.values()].sort((a, b) => a.position - b.position || a.order - b.order)
}

function optionFor(child: ShopwareProductPayload, axis: OptionAxis): ShopwareOptionPayload | undefined {
  return (child.options ?? []).find(option =>
    (optionalString(option.groupId) ?? optionalString(option.group?.id) ?? nameOf(option.group)) === axis.key)
}

/** One Store API parent product, plus its children, as a catalog product. Pure. */
export function mapShopwareProduct(raw: ShopwareProductPayload, context: ShopwareMapContext): MappedProduct {
  if (!optionalString(raw?.id))
    throw new TypeError('Shopware product has no id')

  const externalId = raw.id
  const warnings: CatalogWarning[] = []
  const name = nameOf(raw)
  if (!name)
    throw new TypeError(`Shopware product ${externalId} has no name`)

  const children = context.children ?? []
  const childCount = typeof raw.childCount === 'number' ? raw.childCount : 0
  const hasOptions = children.length > 0
  let variants: CatalogVariant[]
  let optionNames: string[] = []

  if (hasOptions) {
    const axes = optionAxes(children)
    optionNames = axes.map(axis => axis.name)

    const rows = children.map((child) => {
      const picked = axes.map(axis => optionFor(child, axis))
      const optionValues = picked.map(option => nameOf(option) ?? '')
      const productNumber = optionalString(child.productNumber)
      const label = `variant ${productNumber ?? child.id}`
      const prices = pricesOf(child, label, externalId, context, warnings)
      const variant: CatalogVariant = {
        externalId: String(child.id),
        title: optionValues.filter(Boolean).join(' / ') || nameOf(child) || productNumber || name,
        sku: productNumber,
        priceMinor: prices.priceMinor,
        compareAtMinor: prices.compareAtMinor,
        available: availableOf(child),
        inventory: stockOf(child),
        optionValues,
      }
      return { variant, sortKey: picked.map(option => option?.position ?? 0), productNumber: productNumber ?? '' }
    })

    // The storefront's own order: by option position within each group.
    rows.sort((a, b) => {
      for (let i = 0; i < a.sortKey.length; i++) {
        const delta = (a.sortKey[i] ?? 0) - (b.sortKey[i] ?? 0)
        if (delta !== 0)
          return delta
      }
      return a.productNumber.localeCompare(b.productNumber)
    })
    variants = rows.map(row => row.variant)
  }
  else if (childCount > 0) {
    // A parent is never sold itself; its variants are all hidden from this channel.
    warnings.push({ externalId, message: `"${name}" has ${childCount} variant${childCount === 1 ? '' : 's'} in Shopware, none visible to this sales channel; imported without a price` })
    variants = []
  }
  else {
    const prices = pricesOf(raw, `"${name}"`, externalId, context, warnings)
    variants = [{
      externalId,
      title: name,
      sku: optionalString(raw.productNumber),
      priceMinor: prices.priceMinor,
      compareAtMinor: prices.compareAtMinor,
      available: availableOf(raw),
      inventory: stockOf(raw),
      optionValues: [],
    }]
  }

  return {
    product: {
      source: 'shopware',
      externalId,
      name,
      handle: slug(name),
      descriptionHtml: translated(raw, 'description'),
      vendor: nameOf(raw.manufacturer),
      categories: categoriesOf(raw),
      tags: (raw.tags ?? []).map(tag => optionalString(tag?.name)).filter((tag): tag is string => tag !== null),
      currency: context.currency,
      images: imagesOf(raw),
      optionNames,
      variants,
      hasOptions,
      // Shopware's storefront serves every product at /detail/<id>, then
      // redirects to its SEO URL. A headless storefront may route differently.
      url: `${context.storeUrl}/detail/${externalId}`,
    },
    warnings,
  }
}

/**
 * A store URL as the base the Store API hangs off. Accepts the storefront URL
 * or the API endpoint itself (`https://shop.example.com/store-api`), which is
 * what headless storefront configs list.
 */
export function shopwareBaseUrl(storeUrl: string): string {
  return normalizeStoreUrl(storeUrl).replace(/\/store-api$/i, '')
}

/** Why `--access-key` is needed, before any request is made. */
export function missingAccessKeyMessage(): string {
  return `Shopware's Store API needs the sales channel access key: pass --access-key <key> or set SHOPWARE_ACCESS_KEY. It is public by design and not a secret. ${SHOPWARE_ACCESS_KEY_HELP}`
}

/** `errors[0].detail` from a Shopware error body, if there is one. */
function shopwareErrorDetail(body: string | undefined): string | null {
  if (!body)
    return null
  try {
    const parsed = JSON.parse(body) as { errors?: Array<{ detail?: unknown, title?: unknown }> }
    const first = parsed?.errors?.[0]
    return optionalString(first?.detail) ?? optionalString(first?.title)
  }
  catch {
    return null
  }
}

/** A Store API failure, worded for the operator. Never repeats the key. */
function explain(error: CatalogFetchError): CatalogFetchError {
  const detail = shopwareErrorDetail(error.body)
  const said = detail ? ` Shopware said: "${detail}"` : ''

  // A missing key is a 401; a key that matches no sales channel is a 412.
  if (error.status === 401 || error.status === 403 || error.status === 412)
    return new CatalogFetchError(error.url, `${error.message}${said} The sales channel access key looks wrong: check --access-key or SHOPWARE_ACCESS_KEY. ${SHOPWARE_ACCESS_KEY_HELP}`, error.status, error.body)

  return new CatalogFetchError(error.url, `${error.message}${said} ${HINT}`, error.status, error.body)
}

async function storeApi<T>(url: string, accessKey: string, fetcher: FetchLike, json?: unknown): Promise<T> {
  try {
    const { data } = await fetchJson<T>(url, fetcher, '', { headers: { 'sw-access-key': accessKey }, json })
    return data
  }
  catch (error) {
    if (!(error instanceof CatalogFetchError))
      throw error
    throw explain(error)
  }
}

function isKeyError(error: unknown): boolean {
  return error instanceof CatalogFetchError && (error.status === 401 || error.status === 403 || error.status === 412)
}

/** The sales channel currency from `/store-api/context`, or null if it will not say. */
export async function detectShopwareCurrency(base: string, accessKey: string, fetcher: FetchLike = fetch): Promise<string | null> {
  try {
    const data = await storeApi<{ currency?: { isoCode?: unknown } }>(`${base}${API_PREFIX}/context`, accessKey, fetcher)
    const code = typeof data?.currency?.isoCode === 'string' ? data.currency.isoCode.trim().toUpperCase() : ''
    return /^[A-Z]{3}$/.test(code) ? code : null
  }
  catch (error) {
    // A wrong key fails every request; say so now rather than after a warning.
    if (isKeyError(error))
      throw error
    return null
  }
}

/**
 * The fields each mapped record reads, keyed by Shopware's `apiAlias`. Without
 * it a page of 100 products is megabytes of thumbnails and CMS config.
 */
const INCLUDES = {
  product: ['id', 'parentId', 'productNumber', 'name', 'description', 'translated', 'calculatedPrice', 'stock', 'availableStock', 'available', 'active', 'childCount', 'manufacturer', 'seoCategory', 'categories', 'tags', 'cover', 'media', 'options'],
  calculated_price: ['unitPrice', 'quantity', 'listPrice'],
  cart_list_price: ['price'],
  product_media: ['position', 'media'],
  media: ['url', 'alt', 'title', 'translated'],
  product_manufacturer: ['name', 'translated'],
  category: ['name', 'translated'],
  tag: ['name'],
  property_group_option: ['id', 'name', 'translated', 'position', 'groupId', 'group'],
  property_group: ['id', 'name', 'translated', 'position'],
}

/** Criteria for one page of parent products (variants come separately). */
export function shopwareProductCriteria(page: number, limit: number): Record<string, unknown> {
  return {
    'page': page,
    'limit': limit,
    'total-count-mode': 'exact',
    'filter': [{ type: 'equals', field: 'parentId', value: null }],
    // A stable order, or a catalog edited mid-import can skip or repeat rows.
    'sort': [{ field: 'id', order: 'ASC' }],
    'associations': {
      cover: {},
      media: { associations: { media: {} } },
      manufacturer: {},
      categories: {},
      tags: {},
    },
    'includes': INCLUDES,
  }
}

/** Criteria for one page of the variants of `parentIds`. */
export function shopwareVariantCriteria(parentIds: string[], page: number): Record<string, unknown> {
  return {
    'page': page,
    'limit': PAGE_SIZE,
    'total-count-mode': 'exact',
    'filter': [{ type: 'equalsAny', field: 'parentId', value: parentIds }],
    'sort': [{ field: 'id', order: 'ASC' }],
    'associations': { options: { associations: { group: {} } } },
    'includes': INCLUDES,
  }
}

interface ProductList {
  elements?: unknown
  total?: unknown
}

function isLastPage(data: ProductList, page: number, pageSize: number, received: number): boolean {
  if (received < pageSize)
    return true
  const total = typeof data.total === 'number' ? data.total : Number.NaN
  return Number.isInteger(total) && page * pageSize >= total
}

/** Every visible variant of the given parents, grouped by parent id. */
async function fetchChildren(base: string, accessKey: string, parentIds: string[], fetcher: FetchLike): Promise<Map<string, ShopwareProductPayload[]>> {
  const found = new Map<string, ShopwareProductPayload[]>()
  if (parentIds.length === 0)
    return found

  const url = `${base}${API_PREFIX}/product`
  for (let page = 1; page <= MAX_PAGES; page++) {
    const data = await storeApi<ProductList>(url, accessKey, fetcher, shopwareVariantCriteria(parentIds, page))
    if (!Array.isArray(data?.elements))
      throw new CatalogFetchError(url, `${url} did not return a product list for the variants. ${HINT}`)

    const elements = data.elements as ShopwareProductPayload[]
    for (const child of elements) {
      const parent = optionalString(child?.parentId)
      if (!parent)
        continue
      const list = found.get(parent) ?? []
      list.push(child)
      found.set(parent, list)
    }

    if (elements.length === 0 || isLastPage(data, page, PAGE_SIZE, elements.length))
      return found
  }

  throw new CatalogFetchError(url, `Stopped after ${MAX_PAGES} pages of variants from ${url} without reaching the end.`)
}

async function* shopwarePages(storeUrl: string, options: CatalogFetchOptions = {}): AsyncGenerator<CatalogPage> {
  const accessKey = options.accessKey?.trim()
  if (!accessKey)
    throw new TypeError(missingAccessKeyMessage())

  const base = shopwareBaseUrl(storeUrl)
  const fetcher = options.fetch ?? fetch
  const limit = options.limit
  const pageSize = limit && limit > 0 ? Math.min(PAGE_SIZE, limit) : PAGE_SIZE
  const url = `${base}${API_PREFIX}/product`

  // The Store API prices in the sales channel's currency and cannot convert,
  // so what the context reports wins; --currency only fills a gap.
  const setupWarnings: CatalogWarning[] = []
  const override = options.currency?.trim().toUpperCase() || null
  const detected = await detectShopwareCurrency(base, accessKey, fetcher)
  const currency = detected ?? override
  if (detected && override && detected !== override)
    setupWarnings.push({ message: `--currency ${override} ignored: this sales channel prices in ${detected}, and the Store API does not convert.` })
  if (!currency)
    setupWarnings.push({ message: `${base}${API_PREFIX}/context did not report a currency; prices read as 2-decimal amounts. Pass --currency to be sure.` })

  const seen = new Set<string>()
  let emitted = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    const label = `${url} (page ${page})`
    let data: ProductList
    try {
      data = await storeApi<ProductList>(url, accessKey, fetcher, shopwareProductCriteria(page, pageSize))
    }
    catch (error) {
      if (error instanceof CatalogFetchError)
        throw new CatalogFetchError(error.url, error.message.replace(error.url, label), error.status, error.body)
      throw error
    }

    if (!Array.isArray(data?.elements))
      throw new CatalogFetchError(url, `${label} did not return a product list. ${HINT}`)

    const elements = data.elements as ShopwareProductPayload[]
    if (elements.length === 0)
      return

    // A store that ignores `page` serves page 1 forever. Stop rather than loop.
    const ids = elements.map(element => String(element?.id))
    if (page > 1 && ids.every(id => seen.has(id)))
      throw new CatalogFetchError(url, `${label} repeated products from an earlier page; the store is not paginating. Use --limit to import the first page only.`)
    ids.forEach(id => seen.add(id))

    const take = limit ? elements.slice(0, Math.max(0, limit - emitted)) : elements
    const warnings: CatalogWarning[] = page === 1 ? setupWarnings : []

    const parents = take.filter(item => typeof item?.childCount === 'number' && item.childCount > 0).map(item => String(item.id))
    const children = await fetchChildren(base, accessKey, parents, fetcher)

    const products: CatalogProduct[] = []
    for (const entry of take) {
      try {
        const mapped = mapShopwareProduct(entry, { storeUrl: base, currency, children: children.get(String(entry?.id)) })
        products.push(mapped.product)
        warnings.push(...mapped.warnings)
        emitted++
      }
      catch (error) {
        warnings.push({ externalId: entry?.id === undefined ? undefined : String(entry.id), message: `skipped: ${(error as Error).message}` })
      }
    }

    yield { url: label, products, warnings }

    if (limit && emitted >= limit)
      return
    if (isLastPage(data, page, pageSize, elements.length))
      return
  }

  throw new CatalogFetchError(url, `Stopped after ${MAX_PAGES} pages of ${url} without reaching the end.`)
}

export const shopwareAdapter: CatalogAdapter = {
  name: 'shopware',
  pages: shopwarePages,
}
