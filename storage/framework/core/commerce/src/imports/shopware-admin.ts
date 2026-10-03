import type { OrderStatus } from '../orders/events'
import type { AccountAdapter, AccountCustomer, AccountFetchOptions, AccountOrder, AccountOrderLine, AccountPage, MappedAccountRecord } from './account-types'
import type { AdminRequestOptions } from './admin-http'
import type { CatalogWarning, FetchLike } from './types'
import { addressLine, amountOrZero, currencyCode, isoTimestamp, normalizeEmail, personName, phoneOf, quantityOf, signedMinor } from './account-mapping'
import { AdminCredentialError, adminRequest } from './admin-http'
import { ACCOUNT_CREDENTIAL_HELP, credentialSecrets } from './credentials'
import { CatalogFetchError, normalizeStoreUrl } from './http'
import { currencyExponent, PriceFormatError } from './money'
import { cleanName, optionalString } from './text'

/**
 * Shopware 6 customers and orders, through the Admin API (`/api`).
 *
 * Authenticated with an integration's credentials (`SHOPWARE_CLIENT_ID`, the
 * `SWIA...` access key id, and `SHOPWARE_CLIENT_SECRET`) exchanged for a
 * bearer token with the OAuth `client_credentials` grant at
 * `POST /api/oauth/token`. Tokens live about ten minutes, so one that expires
 * mid-import is renewed once and the request repeated.
 *
 * Reads with the search endpoints, `POST /api/search/customer` and
 * `POST /api/search/order`, asking for plain JSON (`{ total, data }`) with
 * `page`/`limit` criteria in ascending id order. `includes` limits every
 * entity to the fields the mappers read: a customer's password is not
 * API-aware in Shopware and is never requested, and an order's transactions
 * are read for their state only, never their payment method or details.
 */

const PAGE_SIZE = 100
const MAX_PAGES = 10_000

const CREDENTIAL_HELP = `Check SHOPWARE_CLIENT_ID and SHOPWARE_CLIENT_SECRET, and that the integration's role may read customers and orders. ${ACCOUNT_CREDENTIAL_HELP.shopware}`
const HINT = 'Is this a Shopware 6 store with the Admin API reachable at /api?'

export interface ShopwareAddressPayload {
  id?: string | null
  firstName?: string | null
  lastName?: string | null
  company?: string | null
  street?: string | null
  additionalAddressLine1?: string | null
  zipcode?: string | null
  city?: string | null
  phoneNumber?: string | null
  country?: { iso?: string | null, name?: string | null } | null
}

export interface ShopwareCustomerPayload {
  id: string
  customerNumber?: string | null
  email?: string | null
  firstName?: string | null
  lastName?: string | null
  company?: string | null
  active?: boolean | null
  guest?: boolean | null
  orderTotalAmount?: number | null
  lastOrderDate?: string | null
  createdAt?: string | null
  defaultBillingAddress?: ShopwareAddressPayload | null
}

export interface ShopwareLineItemPayload {
  id: string
  parentId?: string | null
  productId?: string | null
  referencedId?: string | null
  label?: string | null
  quantity?: number | null
  unitPrice?: number | null
  totalPrice?: number | null
  type?: string | null
  payload?: { productNumber?: string | null, parentId?: string | null } | unknown[] | null
}

interface StatePayload {
  stateMachineState?: { technicalName?: string | null } | null
}

export interface ShopwareOrderPayload extends StatePayload {
  id: string
  orderNumber?: string | null
  orderDateTime?: string | null
  amountTotal?: number | null
  amountNet?: number | null
  shippingTotal?: number | null
  customerComment?: string | null
  billingAddressId?: string | null
  currency?: { isoCode?: string | null } | null
  orderCustomer?: { customerId?: string | null, email?: string | null, firstName?: string | null, lastName?: string | null } | null
  lineItems?: ShopwareLineItemPayload[] | null
  addresses?: ShopwareAddressPayload[] | null
  deliveries?: Array<StatePayload & { shippingOrderAddress?: ShopwareAddressPayload | null }> | null
  transactions?: Array<StatePayload & { createdAt?: string | null }> | null
}

/** One Admin API customer as a normalized customer, or null with the reason. Pure. */
export function mapShopwareCustomer(raw: ShopwareCustomerPayload, context: { currency?: string } = {}): MappedAccountRecord<AccountCustomer> {
  const externalId = optionalString(raw?.id) ?? ''
  const warnings: CatalogWarning[] = []
  const email = normalizeEmail(raw?.email)
  if (!externalId || !email) {
    warnings.push({ externalId: externalId || undefined, message: 'skipped: the customer has no valid email address, which Stacks customers are keyed by' })
    return { record: null, warnings }
  }

  // `orderTotalAmount` is in the system's default currency, which the Admin
  // API does not repeat on the customer; --currency names it, else 2 decimals.
  const currency = currencyCode(context.currency)
  let totalSpentMinor: number | null = null
  try {
    totalSpentMinor = signedMinor(raw.orderTotalAmount ?? null, currencyExponent(currency))
  }
  catch (error) {
    if (!(error instanceof PriceFormatError))
      throw error
    warnings.push({ externalId, message: `orderTotalAmount: ${error.message}; not imported` })
  }

  return {
    record: {
      source: 'shopware',
      externalId,
      email,
      name: personName(raw.firstName, raw.lastName) ?? optionalString(raw.company) ?? email,
      phone: phoneOf(raw.defaultBillingAddress?.phoneNumber),
      active: typeof raw.active === 'boolean' ? raw.active : null,
      totalSpentMinor: totalSpentMinor !== null && totalSpentMinor >= 0 ? totalSpentMinor : null,
      currency,
      lastOrderAt: isoTimestamp(raw.lastOrderDate),
      avatarUrl: null,
      createdAt: isoTimestamp(raw.createdAt),
    },
    warnings,
  }
}

function stateOf(entity: StatePayload | null | undefined): string {
  return (entity?.stateMachineState?.technicalName ?? '').toLowerCase()
}

/** The latest transaction's state: an order retried after a failed payment has several. */
function paymentState(raw: ShopwareOrderPayload): string {
  const transactions = [...(raw.transactions ?? [])].sort((a, b) => String(a?.createdAt ?? '').localeCompare(String(b?.createdAt ?? '')))
  return stateOf(transactions.at(-1))
}

/**
 * The Stacks status for a Shopware order, from its three state machines:
 * the order (open, in_progress, completed, cancelled), the delivery (open,
 * shipped, shipped_partially, returned, ...) and the payment (open, paid,
 * refunded, ...).
 */
export function shopwareOrderStatus(raw: Pick<ShopwareOrderPayload, 'stateMachineState' | 'deliveries' | 'transactions'>): { status: OrderStatus, mapped: boolean, sourceStatus: string } {
  const order = stateOf(raw)
  const delivery = stateOf(raw.deliveries?.[0])
  const payment = paymentState(raw as ShopwareOrderPayload)
  const sourceStatus = `order ${order || 'unknown'}, delivery ${delivery || 'unknown'}, payment ${payment || 'unknown'}`
  const result = (status: OrderStatus, mapped = true) => ({ status, mapped, sourceStatus })

  if (payment === 'refunded')
    return result('REFUNDED')
  if (order === 'cancelled')
    return result('CANCELLED')
  if (order === 'completed')
    return result('DELIVERED')
  if (order === 'open' || order === 'in_progress') {
    if (delivery === 'shipped')
      return result('SHIPPED')
    if (order === 'in_progress' || delivery === 'shipped_partially' || ['paid', 'paid_partially', 'authorized'].includes(payment))
      return result('PROCESSING')
    return result('PENDING')
  }
  return result('PENDING', false)
}

function addressOf(address: ShopwareAddressPayload | null | undefined): string | null {
  if (!address || !optionalString(address.street))
    return null
  return addressLine(
    personName(address.firstName, address.lastName),
    address.company,
    address.street,
    address.additionalAddressLine1,
    [address.zipcode, address.city].map(part => cleanName(part)).filter(Boolean).join(' '),
    address.country?.iso ?? address.country?.name,
  )
}

function payloadOf(item: ShopwareLineItemPayload): { productNumber?: string | null, parentId?: string | null } {
  return item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload) ? item.payload : {}
}

/** One Admin API order as a normalized order, or null with the reason. Pure. */
export function mapShopwareOrder(raw: ShopwareOrderPayload, context: { currency?: string } = {}): MappedAccountRecord<AccountOrder> {
  const externalId = optionalString(raw?.id) ?? ''
  const warnings: CatalogWarning[] = []
  if (!externalId) {
    warnings.push({ message: 'skipped: a Shopware order has no id' })
    return { record: null, warnings }
  }

  const currency = currencyCode(raw.currency?.isoCode) ?? currencyCode(context.currency)
  if (!currency) {
    warnings.push({ externalId, message: 'skipped: the order names no currency; pass --currency' })
    return { record: null, warnings }
  }
  const exponent = currencyExponent(currency)
  const amount = (value: unknown, label: string) => amountOrZero(value, exponent, label, externalId, warnings)

  const lines: AccountOrderLine[] = []
  let discountMinor = 0
  for (const item of raw.lineItems ?? []) {
    // A nested line belongs to a container (a bundle) whose own line is priced.
    if (optionalString(item?.parentId))
      continue
    const lineId = optionalString(item?.id) ?? ''
    const name = cleanName(item?.label) || `Line ${lineId}`
    const type = (item?.type ?? '').toLowerCase()

    let total: number | null = null
    try {
      total = signedMinor(item?.totalPrice ?? null, exponent)
    }
    catch (error) {
      if (!(error instanceof PriceFormatError))
        throw error
      warnings.push({ externalId, message: `line "${name}": ${error.message}; left out` })
      continue
    }

    // Promotions and credits are negative lines; they are the order's discount.
    if (type === 'promotion' || type === 'credit' || (total !== null && total < 0)) {
      discountMinor += Math.abs(total ?? 0)
      continue
    }

    const quantity = quantityOf(item?.quantity)
    if (!lineId || quantity === null) {
      warnings.push({ externalId, message: `line "${name}" has no id or quantity; left out` })
      continue
    }

    const productId = type === 'product' ? optionalString(item.productId) ?? optionalString(item.referencedId) : null
    const payload = payloadOf(item)
    lines.push({
      externalId: lineId,
      // A variant's line names the variant (a child product); the catalog
      // import wrote it as a product_variants row under its parent.
      productExternalId: optionalString(payload.parentId) ?? productId,
      variantExternalId: productId,
      name,
      sku: optionalString(payload.productNumber),
      quantity,
      unitPriceMinor: amount(item.unitPrice, `line "${name}" unit price`),
    })
  }

  const totalMinor = amount(raw.amountTotal, 'total')
  const netMinor = raw.amountNet === null || raw.amountNet === undefined ? totalMinor : amount(raw.amountNet, 'net total')
  const { status, mapped, sourceStatus } = shopwareOrderStatus(raw)
  if (!mapped)
    warnings.push({ externalId, message: `Shopware state "${sourceStatus}" has no Stacks equivalent; imported as ${status}` })

  const billing = (raw.addresses ?? []).find(address => address?.id && address.id === raw.billingAddressId)
  // Only a delivery says where an order ships; the billing address is not one.
  const shipping = raw.deliveries?.[0]?.shippingOrderAddress
    ?? (raw.addresses ?? []).find(address => address?.id && address.id !== raw.billingAddressId)
    ?? null
  const email = normalizeEmail(raw.orderCustomer?.email)
  const customerId = optionalString(raw.orderCustomer?.customerId)

  return {
    record: {
      source: 'shopware',
      externalId,
      number: optionalString(raw.orderNumber),
      currency,
      status,
      sourceStatus,
      totalMinor,
      taxMinor: Math.max(0, totalMinor - netMinor),
      discountMinor,
      shippingMinor: amount(raw.shippingTotal, 'shipping'),
      tipMinor: 0,
      customer: email || customerId
        ? {
            externalId: customerId,
            email,
            name: personName(raw.orderCustomer?.firstName, raw.orderCustomer?.lastName),
            phone: phoneOf(billing?.phoneNumber),
          }
        : null,
      shippingAddress: addressOf(shipping),
      note: optionalString(raw.customerComment),
      placedAt: isoTimestamp(raw.orderDateTime),
      lines,
    },
    warnings,
  }
}

/**
 * The shop's base URL, from the storefront URL or an API endpoint
 * (`.../api`, `.../store-api`). HTTPS only, except on this machine.
 */
export function shopwareAdminBase(storeUrl: string, adminUrl?: string): string {
  const base = normalizeStoreUrl(adminUrl ?? storeUrl).replace(/\/(?:store-)?api$/i, '')
  const { protocol, hostname } = new URL(base)
  const loopback = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '[::1]' || hostname.endsWith('.localhost')
  if (protocol !== 'https:' && !loopback)
    throw new TypeError(`${base} is not HTTPS. The Shopware integration secret and bearer token must never travel in plain text.`)
  return base
}

/** Criteria for one page of customers. */
export function shopwareCustomerCriteria(page: number, limit: number): Record<string, unknown> {
  return {
    'page': page,
    'limit': limit,
    'total-count-mode': 1,
    'sort': [{ field: 'id', order: 'ASC' }],
    'associations': { defaultBillingAddress: {} },
    'includes': {
      customer: ['id', 'customerNumber', 'email', 'firstName', 'lastName', 'company', 'active', 'guest', 'orderTotalAmount', 'lastOrderDate', 'createdAt', 'defaultBillingAddress'],
      customer_address: ['phoneNumber'],
    },
  }
}

const ADDRESS_FIELDS = ['id', 'firstName', 'lastName', 'company', 'street', 'additionalAddressLine1', 'zipcode', 'city', 'phoneNumber', 'country']

/** Criteria for one page of orders, with their line items and addresses. */
export function shopwareOrderCriteria(page: number, limit: number): Record<string, unknown> {
  return {
    'page': page,
    'limit': limit,
    'total-count-mode': 1,
    'sort': [{ field: 'id', order: 'ASC' }],
    'associations': {
      lineItems: {},
      addresses: { associations: { country: {} } },
      currency: {},
      stateMachineState: {},
      orderCustomer: {},
      deliveries: { associations: { stateMachineState: {}, shippingOrderAddress: { associations: { country: {} } } } },
      transactions: { associations: { stateMachineState: {} } },
    },
    'includes': {
      order: ['id', 'orderNumber', 'orderDateTime', 'amountTotal', 'amountNet', 'shippingTotal', 'customerComment', 'billingAddressId', 'currency', 'stateMachineState', 'orderCustomer', 'lineItems', 'addresses', 'deliveries', 'transactions'],
      order_line_item: ['id', 'parentId', 'productId', 'referencedId', 'label', 'quantity', 'unitPrice', 'totalPrice', 'type', 'payload'],
      order_customer: ['customerId', 'email', 'firstName', 'lastName'],
      order_address: ADDRESS_FIELDS,
      order_delivery: ['shippingOrderAddress', 'stateMachineState'],
      order_transaction: ['stateMachineState', 'createdAt'],
      currency: ['isoCode'],
      country: ['iso', 'name'],
      state_machine_state: ['technicalName'],
    },
  }
}

/** A bearer token for the integration, from the client_credentials grant. */
export async function shopwareAccessToken(base: string, clientId: string, clientSecret: string, request: Omit<AdminRequestOptions, 'json' | 'method' | 'headers'>): Promise<string> {
  const url = `${base}/api/oauth/token`
  const { data } = await adminRequest<{ access_token?: unknown }>(url, {
    ...request,
    json: { grant_type: 'client_credentials', client_id: clientId, client_secret: clientSecret },
  })
  const token = typeof data?.access_token === 'string' ? data.access_token.trim() : ''
  if (!token)
    throw new CatalogFetchError(url, `${url} returned no access_token. ${HINT}`)
  return token
}

async function* shopwareResource<Raw extends { id?: unknown }, Out>(
  storeUrl: string,
  options: AccountFetchOptions,
  entity: 'customer' | 'order',
  criteria: (page: number, limit: number) => Record<string, unknown>,
  map: (raw: Raw) => MappedAccountRecord<Out>,
): AsyncGenerator<AccountPage<Out>> {
  if (options.credentials.source !== 'shopware')
    throw new TypeError('The Shopware importer needs Shopware credentials (SHOPWARE_CLIENT_ID and SHOPWARE_CLIENT_SECRET).')

  const base = shopwareAdminBase(storeUrl, options.adminUrl)
  const { clientId, clientSecret } = options.credentials
  const secrets = credentialSecrets(options.credentials)
  const fetcher: FetchLike = options.fetch ?? fetch
  const shared = { fetch: fetcher, secrets, credentialHelp: CREDENTIAL_HELP, hint: HINT, sleep: options.sleep }

  let token = await shopwareAccessToken(base, clientId, clientSecret, shared)
  const search = async (url: string, body: Record<string, unknown>) => {
    const call = () => adminRequest<{ data?: unknown, total?: unknown }>(url, {
      ...shared,
      secrets: [...secrets, token],
      headers: { authorization: `Bearer ${token}` },
      json: body,
    })
    try {
      return await call()
    }
    catch (error) {
      // An expired token is a 401 on a request that worked a minute ago.
      if (!(error instanceof AdminCredentialError) || error.status !== 401)
        throw error
      token = await shopwareAccessToken(base, clientId, clientSecret, shared)
      return await call()
    }
  }

  const url = `${base}/api/search/${entity}`
  const limit = options.limit
  const pageSize = limit && limit > 0 ? Math.min(PAGE_SIZE, limit) : PAGE_SIZE
  const seen = new Set<string>()
  let emitted = 0

  for (let page = 1; page <= MAX_PAGES; page++) {
    const label = `${url} (page ${page})`
    const { data } = await search(url, criteria(page, pageSize))
    if (!Array.isArray(data?.data))
      throw new CatalogFetchError(url, `${label} did not return a "data" list. ${HINT}`)

    const raw = data.data as Raw[]
    if (raw.length === 0)
      return

    const ids = raw.map(entry => String(entry?.id))
    if (page > 1 && ids.every(id => seen.has(id)))
      throw new CatalogFetchError(url, `${label} repeated ${entity}s from an earlier page; the store is not paginating.`)
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

    yield { url: label, items, warnings }

    if (limit && emitted >= limit)
      return
    const total = typeof data.total === 'number' ? data.total : Number.NaN
    if (raw.length < pageSize || (Number.isInteger(total) && page * pageSize >= total))
      return
  }

  throw new CatalogFetchError(url, `Stopped after ${MAX_PAGES} pages of ${url} without reaching the end.`)
}

export const shopwareAccountAdapter: AccountAdapter = {
  name: 'shopware',
  customers: (storeUrl, options) => shopwareResource<ShopwareCustomerPayload, AccountCustomer>(storeUrl, options, 'customer', shopwareCustomerCriteria, raw => mapShopwareCustomer(raw, { currency: options.currency })),
  orders: (storeUrl, options) => shopwareResource<ShopwareOrderPayload, AccountOrder>(storeUrl, options, 'order', shopwareOrderCriteria, raw => mapShopwareOrder(raw, { currency: options.currency })),
}
