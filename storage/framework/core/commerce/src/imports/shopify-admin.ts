import type { OrderStatus } from '../orders/events'
import type { AccountAdapter, AccountCustomer, AccountFetchOptions, AccountOrder, AccountOrderLine, AccountPage, MappedAccountRecord } from './account-types'
import type { CatalogWarning } from './types'
import { addressLine, amountOrZero, currencyCode, isoTimestamp, normalizeEmail, personName, phoneOf, quantityOf, signedMinor } from './account-mapping'
import { adminRequest } from './admin-http'
import { ACCOUNT_CREDENTIAL_HELP, credentialSecrets } from './credentials'
import { CatalogFetchError, normalizeStoreUrl } from './http'
import { currencyExponent, PriceFormatError } from './money'
import { cleanName, optionalString } from './text'

/**
 * Shopify customers and orders, through the Admin REST API.
 *
 * Authenticated with a custom app's Admin API access token in the
 * `X-Shopify-Access-Token` header (from `SHOPIFY_ADMIN_TOKEN`). Pages with
 * cursor pagination: each response's `Link` header carries the next page's
 * `page_info`, and a request with `page_info` may only add `limit` and
 * `fields`, so every follow-up URL is rebuilt from those three.
 *
 * `fields` keeps each response to what the mappers read. Nothing requested
 * carries a password (the Admin API never exposes one) or payment card data
 * (`payment_details` and transactions are not requested).
 *
 * Shopify marked the REST Admin API legacy in October 2024 but keeps serving
 * it to custom apps; the version is pinned so a Shopify-side change is a
 * deliberate bump here, not a silent shape change.
 */

export const SHOPIFY_ADMIN_API_VERSION = '2026-10'

const PAGE_SIZE = 250
const MAX_PAGES = 4000

const CUSTOMER_FIELDS = ['id', 'email', 'first_name', 'last_name', 'phone', 'state', 'total_spent', 'currency', 'created_at', 'default_address']
const ORDER_FIELDS = [
  'id',
  'name',
  'order_number',
  'email',
  'contact_email',
  'created_at',
  'processed_at',
  'cancelled_at',
  'currency',
  'total_price',
  'total_tax',
  'total_discounts',
  'total_shipping_price_set',
  'shipping_lines',
  'total_tip_received',
  'financial_status',
  'fulfillment_status',
  'customer',
  'billing_address',
  'shipping_address',
  'line_items',
  'note',
]

const CREDENTIAL_HELP = `Check SHOPIFY_ADMIN_TOKEN, and that the app is installed on this store with the read_customers and read_orders scopes. ${ACCOUNT_CREDENTIAL_HELP.shopify}`

export interface ShopifyAddressPayload {
  first_name?: string | null
  last_name?: string | null
  name?: string | null
  address1?: string | null
  address2?: string | null
  city?: string | null
  province?: string | null
  province_code?: string | null
  zip?: string | null
  country?: string | null
  country_code?: string | null
  phone?: string | null
}

export interface ShopifyCustomerPayload {
  id: number | string
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  phone?: string | null
  state?: string | null
  total_spent?: string | null
  currency?: string | null
  created_at?: string | null
  default_address?: ShopifyAddressPayload | null
}

export interface ShopifyLineItemPayload {
  id: number | string
  product_id?: number | string | null
  variant_id?: number | string | null
  sku?: string | null
  title?: string | null
  variant_title?: string | null
  name?: string | null
  quantity?: number | null
  price?: string | null
}

export interface ShopifyOrderPayload {
  id: number | string
  name?: string | null
  order_number?: number | null
  email?: string | null
  contact_email?: string | null
  created_at?: string | null
  processed_at?: string | null
  cancelled_at?: string | null
  currency?: string | null
  total_price?: string | null
  total_tax?: string | null
  total_discounts?: string | null
  total_shipping_price_set?: { shop_money?: { amount?: string | null, currency_code?: string | null } | null } | null
  shipping_lines?: Array<{ price?: string | null }> | null
  total_tip_received?: string | null
  financial_status?: string | null
  fulfillment_status?: string | null
  customer?: (Partial<ShopifyCustomerPayload> & { id?: number | string | null }) | null
  billing_address?: ShopifyAddressPayload | null
  shipping_address?: ShopifyAddressPayload | null
  line_items?: ShopifyLineItemPayload[] | null
  note?: string | null
}

/** One Admin API customer as a normalized customer, or null with the reason. Pure. */
export function mapShopifyCustomer(raw: ShopifyCustomerPayload): MappedAccountRecord<AccountCustomer> {
  const externalId = raw?.id === undefined || raw.id === null ? '' : String(raw.id)
  const warnings: CatalogWarning[] = []
  const email = normalizeEmail(raw?.email)
  if (!externalId || !email) {
    warnings.push({ externalId: externalId || undefined, message: 'skipped: the customer has no valid email address, which Stacks customers are keyed by' })
    return { record: null, warnings }
  }

  const currency = currencyCode(raw.currency)
  let totalSpentMinor: number | null = null
  try {
    totalSpentMinor = signedMinor(raw.total_spent, currencyExponent(currency))
  }
  catch (error) {
    if (!(error instanceof PriceFormatError))
      throw error
    warnings.push({ externalId, message: `total_spent: ${error.message}; not imported` })
  }

  return {
    record: {
      source: 'shopify',
      externalId,
      email,
      name: personName(raw.first_name, raw.last_name) ?? personName(raw.default_address?.first_name, raw.default_address?.last_name) ?? email,
      phone: phoneOf(raw.phone, raw.default_address?.phone),
      // `disabled` means "never activated an account", not "banned": a guest
      // checkout creates one. Shopify has no deactivated state, so say nothing.
      active: null,
      totalSpentMinor: totalSpentMinor !== null && totalSpentMinor >= 0 ? totalSpentMinor : null,
      currency,
      lastOrderAt: null,
      avatarUrl: null,
      createdAt: isoTimestamp(raw.created_at),
    },
    warnings,
  }
}

/**
 * The Stacks status for a Shopify order, and whether Shopify's combination
 * was one this knows. Shopify has no "delivered": a fulfilled order shipped.
 */
export function shopifyOrderStatus(raw: Pick<ShopifyOrderPayload, 'financial_status' | 'fulfillment_status' | 'cancelled_at'>): { status: OrderStatus, mapped: boolean } {
  const financial = (raw.financial_status ?? '').toLowerCase()
  const fulfillment = (raw.fulfillment_status ?? '').toLowerCase()

  if (financial === 'refunded')
    return { status: 'REFUNDED', mapped: true }
  if (raw.cancelled_at || financial === 'voided' || fulfillment === 'restocked')
    return { status: 'CANCELLED', mapped: true }
  if (fulfillment === 'fulfilled')
    return { status: 'SHIPPED', mapped: true }
  if (fulfillment === 'partial')
    return { status: 'PROCESSING', mapped: true }
  if (['paid', 'partially_paid', 'partially_refunded', 'authorized'].includes(financial))
    return { status: 'PROCESSING', mapped: true }
  if (financial === 'pending' || financial === 'expired' || financial === '')
    return { status: 'PENDING', mapped: true }
  return { status: 'PENDING', mapped: false }
}

function shippingAddressOf(address: ShopifyAddressPayload | null | undefined): string | null {
  if (!address)
    return null
  return addressLine(
    personName(address.first_name, address.last_name) ?? address.name,
    address.address1,
    address.address2,
    address.city,
    [address.province_code ?? address.province, address.zip].map(part => cleanName(part)).filter(Boolean).join(' '),
    address.country_code ?? address.country,
  )
}

/** One Admin API order as a normalized order, or null with the reason. Pure. */
export function mapShopifyOrder(raw: ShopifyOrderPayload, context: { currency?: string } = {}): MappedAccountRecord<AccountOrder> {
  const externalId = raw?.id === undefined || raw.id === null ? '' : String(raw.id)
  const warnings: CatalogWarning[] = []
  if (!externalId) {
    warnings.push({ message: 'skipped: a Shopify order has no id' })
    return { record: null, warnings }
  }

  // Order amounts are in the shop currency (`currency`); `presentment_currency`
  // is what the buyer saw, and only the `*_set` fields carry it.
  const currency = currencyCode(raw.currency) ?? currencyCode(context.currency)
  if (!currency) {
    warnings.push({ externalId, message: 'skipped: the order names no currency; pass --currency' })
    return { record: null, warnings }
  }
  const exponent = currencyExponent(currency)
  const amount = (value: unknown, label: string) => amountOrZero(value, exponent, label, externalId, warnings)

  const shippingSet = raw.total_shipping_price_set?.shop_money?.amount
  const shippingMinor = shippingSet !== undefined && shippingSet !== null
    ? amount(shippingSet, 'shipping')
    : (raw.shipping_lines ?? []).reduce((sum, line) => sum + amount(line?.price, 'shipping line'), 0)

  const lines: AccountOrderLine[] = []
  for (const item of raw.line_items ?? []) {
    const lineId = item?.id === undefined || item.id === null ? '' : String(item.id)
    const quantity = quantityOf(item?.quantity)
    const name = optionalString(item?.name) ?? personName(item?.title, item?.variant_title) ?? `Line ${lineId}`
    if (!lineId || quantity === null) {
      warnings.push({ externalId, message: `line "${name}" has no id or quantity; left out` })
      continue
    }
    lines.push({
      externalId: lineId,
      productExternalId: item.product_id === undefined || item.product_id === null ? null : String(item.product_id),
      variantExternalId: item.variant_id === undefined || item.variant_id === null ? null : String(item.variant_id),
      name,
      sku: optionalString(item.sku),
      quantity,
      unitPriceMinor: amount(item.price, `line "${name}" price`),
    })
  }

  const { status, mapped } = shopifyOrderStatus(raw)
  const sourceStatus = [raw.financial_status ?? 'no payment status', raw.fulfillment_status ?? 'unfulfilled', raw.cancelled_at ? 'cancelled' : null].filter(Boolean).join(', ')
  if (!mapped)
    warnings.push({ externalId, message: `Shopify status "${sourceStatus}" has no Stacks equivalent; imported as ${status}` })

  const customerEmail = normalizeEmail(raw.customer?.email) ?? normalizeEmail(raw.email) ?? normalizeEmail(raw.contact_email)
  const customerId = raw.customer?.id === undefined || raw.customer?.id === null ? null : String(raw.customer.id)

  return {
    record: {
      source: 'shopify',
      externalId,
      number: optionalString(raw.name) ?? (raw.order_number ? `#${raw.order_number}` : null),
      currency,
      status,
      sourceStatus,
      totalMinor: amount(raw.total_price, 'total'),
      taxMinor: amount(raw.total_tax, 'tax'),
      discountMinor: amount(raw.total_discounts, 'discounts'),
      shippingMinor,
      tipMinor: amount(raw.total_tip_received, 'tip'),
      customer: customerEmail || customerId
        ? {
            externalId: customerId,
            email: customerEmail,
            name: personName(raw.customer?.first_name, raw.customer?.last_name) ?? personName(raw.billing_address?.first_name, raw.billing_address?.last_name),
            phone: phoneOf(raw.customer?.phone, raw.billing_address?.phone),
          }
        : null,
      shippingAddress: shippingAddressOf(raw.shipping_address),
      note: optionalString(raw.note),
      placedAt: isoTimestamp(raw.processed_at) ?? isoTimestamp(raw.created_at),
      lines,
    },
    warnings,
  }
}

/** The `page_info` cursor of the `rel="next"` entry in a `Link` header, or null on the last page. */
export function nextPageInfo(link: string | null | undefined): string | null {
  if (!link)
    return null
  for (const part of link.split(',')) {
    const match = /<([^>]+)>\s*;\s*rel="?next"?/i.exec(part)
    if (!match)
      continue
    try {
      return new URL(match[1]!).searchParams.get('page_info')
    }
    catch {
      return null
    }
  }
  return null
}

/** The admin API base: `adminUrl` when given (a custom domain's `.myshopify.com`), else the store URL. HTTPS only. */
export function shopifyAdminBase(storeUrl: string, adminUrl?: string): string {
  const base = normalizeStoreUrl(adminUrl ?? storeUrl)
  if (!base.startsWith('https://'))
    throw new TypeError(`${base} is not HTTPS. The Shopify Admin API is HTTPS only, and the access token must never travel in plain text.`)
  return base
}

interface ResourceSpec<Raw, Out> {
  resource: 'customers' | 'orders'
  fields: string[]
  /** Query parameters for the first request only; `page_info` requests allow none besides limit and fields. */
  firstQuery: string
  map: (raw: Raw) => MappedAccountRecord<Out>
}

async function* shopifyResource<Raw extends { id?: unknown }, Out>(storeUrl: string, options: AccountFetchOptions, spec: ResourceSpec<Raw, Out>): AsyncGenerator<AccountPage<Out>> {
  if (options.credentials.source !== 'shopify')
    throw new TypeError('The Shopify importer needs Shopify credentials (SHOPIFY_ADMIN_TOKEN).')

  const base = shopifyAdminBase(storeUrl, options.adminUrl)
  const fetcher = options.fetch ?? fetch
  const limit = options.limit
  const pageSize = limit && limit > 0 ? Math.min(PAGE_SIZE, limit) : PAGE_SIZE
  const endpoint = `${base}/admin/api/${SHOPIFY_ADMIN_API_VERSION}/${spec.resource}.json`
  const fields = spec.fields.join(',')
  const request = {
    fetch: fetcher,
    headers: { 'X-Shopify-Access-Token': options.credentials.accessToken },
    secrets: credentialSecrets(options.credentials),
    credentialHelp: CREDENTIAL_HELP,
    hint: `Is ${base} the store's Admin API address? For a custom domain, pass --admin-url https://<store>.myshopify.com.`,
    sleep: options.sleep,
  }

  const seen = new Set<string>()
  let emitted = 0
  let url = `${endpoint}?limit=${pageSize}&fields=${fields}${spec.firstQuery}`

  for (let page = 1; page <= MAX_PAGES; page++) {
    const { data, headers } = await adminRequest<Record<string, unknown>>(url, request)
    const list = data?.[spec.resource]
    if (!Array.isArray(list))
      throw new CatalogFetchError(url, `${url} did not return a "${spec.resource}" list. Is this the Shopify Admin API?`)

    const raw = list as Raw[]
    const ids = raw.map(entry => String(entry?.id))
    if (page > 1 && ids.length > 0 && ids.every(id => seen.has(id)))
      throw new CatalogFetchError(url, `${url} repeated ${spec.resource} from an earlier page; stopping rather than looping.`)
    ids.forEach(id => seen.add(id))

    const items: Out[] = []
    const warnings: CatalogWarning[] = []
    for (const entry of raw) {
      if (limit && emitted >= limit)
        break
      const mapped = spec.map(entry)
      warnings.push(...mapped.warnings)
      if (mapped.record) {
        items.push(mapped.record)
        emitted++
      }
    }

    yield { url, items, warnings }

    const cursor = nextPageInfo(headers.get('link'))
    if (!cursor || raw.length === 0 || (limit && emitted >= limit))
      return
    url = `${endpoint}?limit=${pageSize}&fields=${fields}&page_info=${encodeURIComponent(cursor)}`
  }

  throw new CatalogFetchError(endpoint, `Stopped after ${MAX_PAGES} pages of ${endpoint} without reaching the end.`)
}

export const shopifyAccountAdapter: AccountAdapter = {
  name: 'shopify',
  customers: (storeUrl, options) => shopifyResource<ShopifyCustomerPayload, AccountCustomer>(storeUrl, options, {
    resource: 'customers',
    fields: CUSTOMER_FIELDS,
    firstQuery: '',
    map: mapShopifyCustomer,
  }),
  // `status=any`: the default is open orders only, which would skip every
  // closed and cancelled order without a word.
  orders: (storeUrl, options) => shopifyResource<ShopifyOrderPayload, AccountOrder>(storeUrl, options, {
    resource: 'orders',
    fields: ORDER_FIELDS,
    firstQuery: '&status=any',
    map: raw => mapShopifyOrder(raw, { currency: options.currency }),
  }),
}
