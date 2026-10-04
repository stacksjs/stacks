import type { OrderStatus } from '../orders/events'
import type { AccountAdapter, AccountCustomer, AccountFetchOptions, AccountOrder, AccountOrderLine, AccountPage, MappedAccountRecord } from './account-types'
import type { CatalogWarning } from './types'
import { addressLine, amountOrZero, currencyCode, gmtTimestamp, normalizeEmail, personName, phoneOf, quantityOf, signedMinor, unitFromTotal } from './account-mapping'
import { adminRequest } from './admin-http'
import { ACCOUNT_CREDENTIAL_HELP, credentialSecrets } from './credentials'
import { CatalogFetchError, normalizeStoreUrl } from './http'
import { currencyExponent, PriceFormatError } from './money'
import { cleanName, optionalString } from './text'

/**
 * WooCommerce customers and orders, through the REST API v3
 * (`/wp-json/wc/v3`).
 *
 * Authenticated with a REST API consumer key and secret
 * (`WOOCOMMERCE_CONSUMER_KEY` / `WOOCOMMERCE_CONSUMER_SECRET`) as HTTP Basic
 * auth, which WooCommerce accepts over HTTPS only; over plain HTTP it demands
 * OAuth 1.0a signatures instead, and Basic auth would put the secret on the
 * wire. A store URL that is not HTTPS is refused before any request. The keys
 * never go in the query string (`?consumer_key=`), where access logs keep them.
 *
 * Pages with `page` and `per_page` (at most 100), stopping at
 * `X-WP-TotalPages`, in ascending id order so a store taking orders during the
 * import cannot shift a record between pages.
 *
 * Customer records carry no password (WooCommerce treats it as write-only),
 * and the order fields mapped exclude payment details: `payment_method` and
 * `transaction_id` are never read.
 */

const PAGE_SIZE = 100
const MAX_PAGES = 10_000
const API_PATH = '/wp-json/wc/v3'

const CREDENTIAL_HELP = `Check WOOCOMMERCE_CONSUMER_KEY and WOOCOMMERCE_CONSUMER_SECRET, and that the key has Read permission. If the key is right and every request is a 401, the web server may be stripping the Authorization header (common with Apache and CGI PHP). ${ACCOUNT_CREDENTIAL_HELP.woocommerce}`
const HINT = 'Is WooCommerce installed with the REST API reachable at /wp-json/wc/v3, and pretty permalinks enabled?'

export interface WooAddressPayload {
  first_name?: string | null
  last_name?: string | null
  company?: string | null
  address_1?: string | null
  address_2?: string | null
  city?: string | null
  state?: string | null
  postcode?: string | null
  country?: string | null
  email?: string | null
  phone?: string | null
}

export interface WooCustomerPayload {
  id: number | string
  email?: string | null
  first_name?: string | null
  last_name?: string | null
  username?: string | null
  role?: string | null
  date_created_gmt?: string | null
  billing?: WooAddressPayload | null
  shipping?: WooAddressPayload | null
  avatar_url?: string | null
}

export interface WooOrderLinePayload {
  id: number | string
  name?: string | null
  product_id?: number | null
  variation_id?: number | null
  quantity?: number | null
  subtotal?: string | null
  total?: string | null
  sku?: string | null
}

export interface WooOrderPayload {
  id: number | string
  number?: string | null
  status?: string | null
  currency?: string | null
  date_created_gmt?: string | null
  discount_total?: string | null
  shipping_total?: string | null
  total?: string | null
  total_tax?: string | null
  customer_id?: number | null
  customer_note?: string | null
  billing?: WooAddressPayload | null
  shipping?: WooAddressPayload | null
  line_items?: WooOrderLinePayload[] | null
  fee_lines?: Array<{ id?: number | string, name?: string | null, total?: string | null }> | null
  /** Refunds so far, each with a negative `total` ("-9.99"). */
  refunds?: Array<{ id?: number | string, reason?: string | null, total?: string | null }> | null
}

/** WooCommerce's order statuses, and the ones that are not orders at all. */
const WOO_STATUS: Record<string, OrderStatus> = {
  'pending': 'PENDING',
  'on-hold': 'PENDING',
  'processing': 'PROCESSING',
  // WooCommerce's terminal success state: fulfilled, nothing left to do.
  'completed': 'DELIVERED',
  'cancelled': 'CANCELLED',
  'failed': 'CANCELLED',
  'refunded': 'REFUNDED',
}
const NOT_ORDERS = new Set(['checkout-draft', 'auto-draft', 'trash'])

/** The Stacks status for a WooCommerce status, and whether it was a known one. */
export function wooOrderStatus(status: string | null | undefined): { status: OrderStatus, mapped: boolean } {
  const mapped = WOO_STATUS[(status ?? '').toLowerCase()]
  return mapped ? { status: mapped, mapped: true } : { status: 'PENDING', mapped: false }
}

/** An https avatar URL, or null. WordPress serves Gravatar links. */
function httpsUrl(value: unknown): string | null {
  const raw = optionalString(value)
  if (!raw)
    return null
  try {
    return new URL(raw).protocol === 'https:' ? raw : null
  }
  catch {
    return null
  }
}

/** One REST API customer as a normalized customer, or null with the reason. Pure. */
export function mapWooCustomer(raw: WooCustomerPayload): MappedAccountRecord<AccountCustomer> {
  const externalId = raw?.id === undefined || raw.id === null ? '' : String(raw.id)
  const warnings: CatalogWarning[] = []
  const email = normalizeEmail(raw?.email) ?? normalizeEmail(raw?.billing?.email)
  if (!externalId || !email) {
    warnings.push({ externalId: externalId || undefined, message: 'skipped: the customer has no valid email address, which Stacks customers are keyed by' })
    return { record: null, warnings }
  }

  return {
    record: {
      source: 'woocommerce',
      externalId,
      email,
      name: personName(raw.first_name, raw.last_name) ?? personName(raw.billing?.first_name, raw.billing?.last_name) ?? email,
      phone: phoneOf(raw.billing?.phone, raw.shipping?.phone),
      active: null,
      // The v3 customer has no lifetime spend or last order date.
      totalSpentMinor: null,
      currency: null,
      lastOrderAt: null,
      avatarUrl: httpsUrl(raw.avatar_url),
      createdAt: gmtTimestamp(raw.date_created_gmt),
    },
    warnings,
  }
}

function shippingAddressOf(address: WooAddressPayload | null | undefined): string | null {
  if (!address || !optionalString(address.address_1))
    return null
  return addressLine(
    personName(address.first_name, address.last_name),
    address.company,
    address.address_1,
    address.address_2,
    address.city,
    [address.state, address.postcode].map(part => cleanName(part)).filter(Boolean).join(' '),
    address.country,
  )
}

/** One REST API order as a normalized order, or null with the reason. Pure. */
export function mapWooOrder(raw: WooOrderPayload, context: { currency?: string } = {}): MappedAccountRecord<AccountOrder> {
  const externalId = raw?.id === undefined || raw.id === null ? '' : String(raw.id)
  const warnings: CatalogWarning[] = []
  if (!externalId) {
    warnings.push({ message: 'skipped: a WooCommerce order has no id' })
    return { record: null, warnings }
  }

  const sourceStatus = (raw.status ?? '').toLowerCase()
  if (NOT_ORDERS.has(sourceStatus)) {
    warnings.push({ externalId, message: `skipped: status "${sourceStatus}" is not a placed order` })
    return { record: null, warnings }
  }

  const currency = currencyCode(raw.currency) ?? currencyCode(context.currency)
  if (!currency) {
    warnings.push({ externalId, message: 'skipped: the order names no currency; pass --currency' })
    return { record: null, warnings }
  }
  const exponent = currencyExponent(currency)
  const amount = (value: unknown, label: string) => amountOrZero(value, exponent, label, externalId, warnings)

  const lines: AccountOrderLine[] = []
  for (const item of raw.line_items ?? []) {
    const lineId = item?.id === undefined || item.id === null ? '' : String(item.id)
    const quantity = quantityOf(item?.quantity)
    const name = cleanName(item?.name) || `Line ${lineId}`
    if (!lineId || quantity === null) {
      warnings.push({ externalId, message: `line "${name}" has no id or quantity; left out` })
      continue
    }
    // `subtotal` is the line before coupons, `total` after; the coupons are
    // the order's discount_total, so the unit price is taken before them.
    const subtotal = amount(item.subtotal ?? item.total, `line "${name}" subtotal`)
    lines.push({
      externalId: lineId,
      productExternalId: item.product_id ? String(item.product_id) : null,
      variantExternalId: item.variation_id ? String(item.variation_id) : null,
      name,
      sku: optionalString(item.sku),
      quantity,
      unitPriceMinor: unitFromTotal(subtotal, quantity),
    })
  }

  // A fee is a line the merchant added (gift wrap, a surcharge). A negative
  // fee is how some plugins discount, so it adds to the discount instead.
  let feeDiscount = 0
  for (const fee of raw.fee_lines ?? []) {
    const name = cleanName(fee?.name) || 'Fee'
    let minor: number | null = null
    try {
      minor = signedMinor(fee?.total, exponent)
    }
    catch (error) {
      if (!(error instanceof PriceFormatError))
        throw error
      warnings.push({ externalId, message: `fee "${name}": ${error.message}; left out` })
    }
    if (minor === null || minor === 0)
      continue
    if (minor < 0) {
      feeDiscount += -minor
      continue
    }
    lines.push({ externalId: `fee-${fee?.id ?? lines.length}`, productExternalId: null, variantExternalId: null, name, sku: null, quantity: 1, unitPriceMinor: minor })
  }

  const { status, mapped } = wooOrderStatus(sourceStatus)
  if (!mapped)
    warnings.push({ externalId, message: `WooCommerce status "${sourceStatus || 'none'}" has no Stacks equivalent; imported as ${status}` })

  const customerId = raw.customer_id ? String(raw.customer_id) : null
  const email = normalizeEmail(raw.billing?.email)

  // A refund's total is negative; the order's own total stays what was charged.
  let refundedMinor = 0
  for (const refund of raw.refunds ?? []) {
    try {
      refundedMinor += Math.abs(signedMinor(refund?.total, exponent) ?? 0)
    }
    catch (error) {
      if (!(error instanceof PriceFormatError))
        throw error
      warnings.push({ externalId, message: `refund ${refund?.id ?? ''}: ${error.message}; not counted` })
    }
  }

  return {
    record: {
      source: 'woocommerce',
      externalId,
      number: optionalString(raw.number) ? `#${optionalString(raw.number)}` : null,
      currency,
      status,
      sourceStatus: sourceStatus || 'none',
      totalMinor: amount(raw.total, 'total'),
      taxMinor: amount(raw.total_tax, 'tax'),
      discountMinor: amount(raw.discount_total, 'discounts') + feeDiscount,
      shippingMinor: amount(raw.shipping_total, 'shipping'),
      tipMinor: 0,
      customer: email || customerId
        ? {
            externalId: customerId,
            email,
            name: personName(raw.billing?.first_name, raw.billing?.last_name),
            phone: phoneOf(raw.billing?.phone),
          }
        : null,
      shippingAddress: shippingAddressOf(raw.shipping),
      note: optionalString(raw.customer_note),
      placedAt: gmtTimestamp(raw.date_created_gmt),
      lines,
      refundedMinor,
    },
    warnings,
  }
}

/** The REST API base for a store URL. HTTPS only: Basic auth over HTTP sends the secret in the clear. */
export function wooAdminBase(storeUrl: string, adminUrl?: string): string {
  const base = normalizeStoreUrl(adminUrl ?? storeUrl)
  if (!base.startsWith('https://'))
    throw new TypeError(`${base} is not HTTPS. WooCommerce REST API keys are sent with HTTP Basic auth, which is only safe (and only accepted by WooCommerce) over HTTPS. Use the store's https:// address.`)
  return base
}

/** `Authorization: Basic ...` for a consumer key and secret. */
export function wooAuthorization(consumerKey: string, consumerSecret: string): string {
  return `Basic ${Buffer.from(`${consumerKey}:${consumerSecret}`, 'utf8').toString('base64')}`
}

async function* wooResource<Raw extends { id?: unknown }, Out>(storeUrl: string, options: AccountFetchOptions, resource: 'customers' | 'orders', map: (raw: Raw) => MappedAccountRecord<Out>): AsyncGenerator<AccountPage<Out>> {
  if (options.credentials.source !== 'woocommerce')
    throw new TypeError('The WooCommerce importer needs WooCommerce credentials (WOOCOMMERCE_CONSUMER_KEY and WOOCOMMERCE_CONSUMER_SECRET).')

  const base = wooAdminBase(storeUrl, options.adminUrl)
  const { consumerKey, consumerSecret } = options.credentials
  const authorization = wooAuthorization(consumerKey, consumerSecret)
  const request = {
    fetch: options.fetch ?? fetch,
    headers: { authorization },
    secrets: [...credentialSecrets(options.credentials), authorization.slice('Basic '.length)],
    credentialHelp: CREDENTIAL_HELP,
    hint: HINT,
    sleep: options.sleep,
  }

  const limit = options.limit
  const pageSize = limit && limit > 0 ? Math.min(PAGE_SIZE, limit) : PAGE_SIZE
  const seen = new Set<string>()
  let emitted = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    const url = `${base}${API_PATH}/${resource}?per_page=${pageSize}&page=${page}&orderby=id&order=asc`
    const { data, headers } = await adminRequest<unknown>(url, request)
    if (!Array.isArray(data))
      throw new CatalogFetchError(url, `${url} did not return a list of ${resource}. ${HINT}`)

    const raw = data as Raw[]
    if (raw.length === 0)
      return

    const ids = raw.map(entry => String(entry?.id))
    if (page > 1 && ids.every(id => seen.has(id)))
      throw new CatalogFetchError(url, `${url} repeated ${resource} from an earlier page; the store is not paginating.`)
    ids.forEach(id => seen.add(id))

    const items: Out[] = []
    const warnings: CatalogWarning[] = []
    for (const entry of raw) {
      if (limit && emitted >= limit)
        break
      const mapped = map(entry)
      warnings.push(...mapped.warnings)
      if (mapped.record) {
        items.push(mapped.record)
        emitted++
      }
    }

    yield { url, items, warnings }

    // `Number(null)` is 0, which would read a missing header as "no pages".
    const header = headers.get('x-wp-totalpages')?.trim()
    const totalPages = header ? Number(header) : Number.NaN
    if (limit && emitted >= limit)
      return
    if (Number.isInteger(totalPages) && page >= totalPages)
      return
  }

  throw new CatalogFetchError(`${base}${API_PATH}/${resource}`, `Stopped after ${MAX_PAGES} pages of ${base}${API_PATH}/${resource} without reaching the end.`)
}

export const wooCommerceAccountAdapter: AccountAdapter = {
  name: 'woocommerce',
  customers: (storeUrl, options) => wooResource<WooCustomerPayload, AccountCustomer>(storeUrl, options, 'customers', mapWooCustomer),
  orders: (storeUrl, options) => wooResource<WooOrderPayload, AccountOrder>(storeUrl, options, 'orders', raw => mapWooOrder(raw, { currency: options.currency })),
}
