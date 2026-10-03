import type { AccountAdapter, AccountCredentials, AccountFetchOptions, AccountPage, FetchLike } from '../imports'
import { describe, expect, it } from 'bun:test'
import {
  AdminCredentialError,
  CatalogFetchError,
  nextPageInfo,
  retryAfterSeconds,
  SHOPIFY_ADMIN_API_VERSION,
  shopifyAccountAdapter,
  shopwareAccountAdapter,
  wooAuthorization,
  wooCommerceAccountAdapter,
} from '../imports'
import shopifyCustomers from './fixtures/account-import/shopify-customers.json'
import shopifyOrders from './fixtures/account-import/shopify-orders.json'
import shopwareCustomers from './fixtures/account-import/shopware-customers.json'
import shopwareOrders from './fixtures/account-import/shopware-orders.json'
import shopwareToken from './fixtures/account-import/shopware-token.json'
import wooCustomers from './fixtures/account-import/woocommerce-customers.json'
import wooOrders from './fixtures/account-import/woocommerce-orders.json'

/**
 * Paging through each admin API against a fake `fetch`.
 *
 * Every route is listed per test and an unlisted request fails it, so "asks
 * for the right page" and "stops at the end" are both checked. Every request
 * is also checked for its credential header: a request that would go out
 * unauthenticated, or with the wrong scheme, fails the test.
 */

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body: any
}

type Handler = (call: Call) => Response | unknown

function json(body: unknown, headers: Record<string, string> = {}, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', ...headers } })
}

function fakeFetch(routes: Record<string, Handler | unknown>, auth: (call: Call) => void): FetchLike & { calls: Call[] } {
  const calls: Call[] = []
  const queue = new Map<string, unknown[]>()
  const fetcher = (async (input: string, init?: RequestInit) => {
    const headers = Object.fromEntries(Object.entries((init?.headers ?? {}) as Record<string, string>).map(([key, value]) => [key.toLowerCase(), value]))
    const call: Call = { url: input, method: init?.method ?? 'GET', headers, body: init?.body ? JSON.parse(String(init.body)) : undefined }
    calls.push(call)
    const key = `${call.method} ${input}`
    if (!(key in routes))
      throw new Error(`unexpected request ${key}`)
    auth(call)
    let route = routes[key]
    // An array is a sequence of answers, one per call.
    if (Array.isArray(route)) {
      const remaining = queue.get(key) ?? [...route]
      queue.set(key, remaining)
      route = remaining.length > 1 ? remaining.shift() : remaining[0]
    }
    if (typeof route === 'function')
      return (route as Handler)(call)
    if (route instanceof Response)
      return route
    return json(route)
  }) as FetchLike & { calls: Call[] }
  fetcher.calls = calls
  return fetcher
}

async function collect<T>(pages: AsyncIterable<AccountPage<T>>): Promise<AccountPage<T>[]> {
  const result: AccountPage<T>[] = []
  for await (const page of pages)
    result.push(page)
  return result
}

const noSleep = { waits: [] as number[], sleep(ms: number) {
  noSleep.waits.push(ms)
  return Promise.resolve()
} }

async function failure(promise: Promise<unknown>): Promise<Error> {
  try {
    await promise
  }
  catch (error) {
    return error as Error
  }
  throw new Error('expected a rejection')
}

function run(adapter: AccountAdapter, kind: 'customers' | 'orders', url: string, options: AccountFetchOptions) {
  return collect<any>(adapter[kind](url, options))
}

describe('Shopify Admin API paging', () => {
  const SHOP = 'https://northwind.myshopify.com'
  const API = `${SHOP}/admin/api/${SHOPIFY_ADMIN_API_VERSION}`
  const credentials: AccountCredentials = { source: 'shopify', accessToken: 'shpat_fixture_token_0001' }
  const tokenHeader = (call: Call) => expect(call.headers['x-shopify-access-token']).toBe('shpat_fixture_token_0001')
  const [bob, phoneOnly, jane] = shopifyCustomers.customers
  const customerFields = 'id,email,first_name,last_name,phone,state,total_spent,currency,created_at,default_address'

  it('follows the Link header cursor, rebuilding each URL from limit, fields and page_info', async () => {
    const fetcher = fakeFetch({
      [`GET ${API}/customers.json?limit=250&fields=${customerFields}`]: () => json({ customers: [bob, phoneOnly] }, {
        link: `<${API}/customers.json?limit=250&page_info=eyJsYXN0X2lkIjoyfQ>; rel="next"`,
      }),
      [`GET ${API}/customers.json?limit=250&fields=${customerFields}&page_info=eyJsYXN0X2lkIjoyfQ`]: () => json({ customers: [jane] }, {
        link: `<${API}/customers.json?limit=250&page_info=eyJsYXN0X2lkIjoyfQ>; rel="previous"`,
      }),
    }, tokenHeader)

    const pages = await run(shopifyAccountAdapter, 'customers', SHOP, { credentials, fetch: fetcher })

    expect(pages.map(page => page.items.map((customer: any) => customer.email))).toEqual([['bob.norman@mail.example.com'], ['jane.roe@example.com']])
    expect(pages[0]!.warnings).toHaveLength(1)
    expect(fetcher.calls).toHaveLength(2)
  })

  it('asks for every order (status=any) on the first page only, and honors --limit', async () => {
    const fetcher = fakeFetch({
      [`GET ${API}/orders.json?limit=2&fields=${'id,name,order_number,email,contact_email,created_at,processed_at,cancelled_at,currency,total_price,total_tax,total_discounts,total_shipping_price_set,shipping_lines,total_tip_received,financial_status,fulfillment_status,customer,billing_address,shipping_address,line_items,note'}&status=any`]: () => json(
        { orders: shopifyOrders.orders.slice(0, 2) },
        { link: `<${API}/orders.json?limit=2&page_info=next1>; rel="next"` },
      ),
    }, tokenHeader)

    const pages = await run(shopifyAccountAdapter, 'orders', SHOP, { credentials, fetch: fetcher, limit: 2 })
    expect(pages.flatMap(page => page.items).map((order: any) => order.number)).toEqual(['#1001', '#1002'])
    expect(fetcher.calls).toHaveLength(1)
  })

  it('talks to the .myshopify.com address when --admin-url is given', async () => {
    const fetcher = fakeFetch({
      [`GET ${API}/customers.json?limit=250&fields=${customerFields}`]: { customers: [] },
    }, tokenHeader)
    expect(await run(shopifyAccountAdapter, 'customers', 'https://shop.example.com', { credentials, fetch: fetcher, adminUrl: 'northwind.myshopify.com' })).toEqual([
      { url: `${API}/customers.json?limit=250&fields=${customerFields}`, items: [], warnings: [] },
    ])
  })

  it('waits out a 429 for as long as Retry-After says, then retries', async () => {
    noSleep.waits = []
    const url = `${API}/customers.json?limit=250&fields=${customerFields}`
    const fetcher = fakeFetch({
      [`GET ${url}`]: [
        () => new Response('{"errors":"Exceeded 2 calls per second for api client. Reduce request rates to resume uninterrupted service."}', { status: 429, headers: { 'retry-after': '2.0' } }),
        () => new Response('{}', { status: 429, headers: { 'retry-after': '0.5' } }),
        { customers: [bob] },
      ],
    }, tokenHeader)

    const pages = await run(shopifyAccountAdapter, 'customers', SHOP, { credentials, fetch: fetcher, sleep: noSleep.sleep })
    expect(pages[0]!.items).toHaveLength(1)
    expect(noSleep.waits).toEqual([2000, 500])
    expect(fetcher.calls).toHaveLength(3)
  })

  it('gives up after repeated 429s with a resumable message', async () => {
    const url = `${API}/customers.json?limit=250&fields=${customerFields}`
    const fetcher = fakeFetch({ [`GET ${url}`]: () => new Response('', { status: 429 }) }, tokenHeader)
    const error = await failure(run(shopifyAccountAdapter, 'customers', SHOP, { credentials, fetch: fetcher, sleep: async () => {} }))
    expect(error.message).toContain('Still rate limited after 5 retries')
    expect(fetcher.calls).toHaveLength(6)
  })

  it('explains a 401 and a 403 in terms of the credential, never echoing it', async () => {
    const url = `${API}/customers.json?limit=250&fields=${customerFields}`
    for (const status of [401, 403]) {
      const fetcher = fakeFetch({
        [`GET ${url}`]: () => new Response(`{"errors":"[API] Invalid API key or access token (unrecognized login or wrong password): shpat_fixture_token_0001"}`, { status }),
      }, tokenHeader)
      const error = await failure(run(shopifyAccountAdapter, 'customers', SHOP, { credentials, fetch: fetcher }))
      expect(error).toBeInstanceOf(AdminCredentialError)
      expect(error.message).toContain(`${url} responded ${status}`)
      expect(error.message).toContain('SHOPIFY_ADMIN_TOKEN')
      expect(error.message).toContain('read_customers')
      expect(error.message).not.toContain('shpat_fixture_token_0001')
    }
  })

  it('refuses plain HTTP before sending the token anywhere', async () => {
    const fetcher = fakeFetch({}, tokenHeader)
    const error = await failure(run(shopifyAccountAdapter, 'customers', 'http://northwind.myshopify.com', { credentials, fetch: fetcher }))
    expect(error.message).toContain('is not HTTPS')
    expect(fetcher.calls).toHaveLength(0)
  })

  it('reads the next cursor out of a Link header', () => {
    expect(nextPageInfo(`<https://s.myshopify.com/admin/api/2026-10/orders.json?limit=50&page_info=prev>; rel="previous", <https://s.myshopify.com/admin/api/2026-10/orders.json?limit=50&page_info=abc123>; rel="next"`)).toBe('abc123')
    expect(nextPageInfo(`<https://s.myshopify.com/admin/api/2026-10/orders.json?page_info=prev>; rel="previous"`)).toBeNull()
    expect(nextPageInfo(null)).toBeNull()
  })

  it('reads Retry-After as seconds or an HTTP date', () => {
    expect(retryAfterSeconds('2.0')).toBe(2)
    expect(retryAfterSeconds('Wed, 21 Oct 2026 07:28:05 GMT', () => Date.parse('Wed, 21 Oct 2026 07:28:00 GMT'))).toBe(5)
    expect(retryAfterSeconds('soon')).toBeUndefined()
    expect(retryAfterSeconds(null)).toBeUndefined()
  })
})

describe('WooCommerce REST API paging', () => {
  const STORE = 'https://example.co.uk/shop'
  const API = `${STORE}/wp-json/wc/v3`
  const credentials: AccountCredentials = { source: 'woocommerce', consumerKey: 'ck_fixture0000000000000000000000000000001', consumerSecret: 'cs_fixture0000000000000000000000000000001' }
  const basic = (call: Call) => expect(call.headers.authorization).toBe(wooAuthorization(credentials.source === 'woocommerce' ? credentials.consumerKey : '', credentials.source === 'woocommerce' ? credentials.consumerSecret : ''))

  it('sends HTTP Basic auth, never the keys in the URL', () => {
    expect(wooAuthorization('ck_a', 'cs_b')).toBe(`Basic ${btoa('ck_a:cs_b')}`)
  })

  it('pages in id order until X-WP-TotalPages, keeping a subdirectory install', async () => {
    const fetcher = fakeFetch({
      [`GET ${API}/orders?per_page=100&page=1&orderby=id&order=asc`]: () => json(wooOrders.slice(0, 2), { 'x-wp-total': '4', 'x-wp-totalpages': '2' }),
      [`GET ${API}/orders?per_page=100&page=2&orderby=id&order=asc`]: () => json(wooOrders.slice(2), { 'x-wp-total': '4', 'x-wp-totalpages': '2' }),
    }, basic)

    const pages = await run(wooCommerceAccountAdapter, 'orders', STORE, { credentials, fetch: fetcher })
    expect(pages.map(page => page.items.map((order: any) => order.externalId))).toEqual([['727'], ['729', '730']])
    // The draft is reported, not imported.
    expect(pages[0]!.warnings[0]!.message).toContain('checkout-draft')
    expect(fetcher.calls.map(call => call.url).every(url => !url.includes('consumer_'))).toBe(true)
  })

  it('stops on an empty page when the header is missing', async () => {
    const fetcher = fakeFetch({
      [`GET ${API}/customers?per_page=100&page=1&orderby=id&order=asc`]: () => json(wooCustomers),
      [`GET ${API}/customers?per_page=100&page=2&orderby=id&order=asc`]: () => json([]),
    }, basic)
    const pages = await run(wooCommerceAccountAdapter, 'customers', STORE, { credentials, fetch: fetcher })
    expect(pages.flatMap(page => page.items)).toHaveLength(2)
    expect(fetcher.calls).toHaveLength(2)
  })

  it('refuses a store that is not HTTPS before any request', async () => {
    const fetcher = fakeFetch({}, basic)
    const error = await failure(run(wooCommerceAccountAdapter, 'orders', 'http://example.co.uk/shop', { credentials, fetch: fetcher }))
    expect(error.message).toContain('is not HTTPS')
    expect(error.message).toContain('Basic auth')
    expect(fetcher.calls).toHaveLength(0)
  })

  it('words a 401 for the operator, without the key, the secret, or their encoding', async () => {
    const authorization = wooAuthorization('ck_fixture0000000000000000000000000000001', 'cs_fixture0000000000000000000000000000001')
    const fetcher = fakeFetch({
      [`GET ${API}/customers?per_page=100&page=1&orderby=id&order=asc`]: () => json({ code: 'woocommerce_rest_cannot_view', message: `Sorry, you cannot list resources. (${authorization})`, data: { status: 401 } }, {}, 401),
    }, basic)
    const error = await failure(run(wooCommerceAccountAdapter, 'customers', STORE, { credentials, fetch: fetcher }))
    expect(error).toBeInstanceOf(AdminCredentialError)
    expect(error.message).toContain('WOOCOMMERCE_CONSUMER_KEY and WOOCOMMERCE_CONSUMER_SECRET')
    expect(error.message).toContain('Authorization header')
    for (const secret of ['ck_fixture', 'cs_fixture', authorization.slice(6)])
      expect(error.message).not.toContain(secret)
  })

  it('names the URL and status of any other failure', async () => {
    const url = `${API}/orders?per_page=100&page=1&orderby=id&order=asc`
    const fetcher = fakeFetch({ [`GET ${url}`]: () => new Response('Not Found', { status: 404, statusText: 'Not Found' }) }, basic)
    const error = await failure(run(wooCommerceAccountAdapter, 'orders', STORE, { credentials, fetch: fetcher }))
    expect(error).toBeInstanceOf(CatalogFetchError)
    expect(error.message).toContain(`${url} responded 404 Not Found.`)
    expect(error.message).toContain('/wp-json/wc/v3')
  })
})

describe('Shopware Admin API paging', () => {
  const SHOP = 'https://shop.example.de'
  const credentials: AccountCredentials = { source: 'shopware', clientId: 'SWIAFIXTURECLIENTID0000001', clientSecret: 'fixture-secret-0000000000000000000000000001' }
  const TOKEN = shopwareToken.access_token

  function authorized(call: Call): void {
    if (call.url.endsWith('/api/oauth/token')) {
      expect(call.method).toBe('POST')
      expect(call.headers.authorization).toBeUndefined()
      expect(call.body).toEqual({ grant_type: 'client_credentials', client_id: credentials.source === 'shopware' ? credentials.clientId : '', client_secret: credentials.source === 'shopware' ? credentials.clientSecret : '' })
      return
    }
    expect(call.headers.authorization).toMatch(/^Bearer /)
    expect(call.headers.accept).toBe('application/json')
  }

  it('gets a token, then pages the search with criteria page and limit', async () => {
    const many = Array.from({ length: 150 }, (_, index) => ({ ...shopwareCustomers.data[0], id: `0190c0ffee0a4b5c8d9e0f1a2b3c${String(index).padStart(4, '0')}`, email: `customer${index}@example.de` }))
    const fetcher = fakeFetch({
      [`POST ${SHOP}/api/oauth/token`]: shopwareToken,
      [`POST ${SHOP}/api/search/customer`]: (call: Call) => {
        expect(call.headers.authorization).toBe(`Bearer ${TOKEN}`)
        expect(call.body).toMatchObject({ 'limit': 100, 'total-count-mode': 1, 'sort': [{ field: 'id', order: 'ASC' }], 'associations': { defaultBillingAddress: {} } })
        expect(call.body.includes.customer).not.toContain('password')
        const start = (call.body.page - 1) * 100
        return json({ total: many.length, data: many.slice(start, start + 100), aggregations: [] })
      },
    }, authorized)

    // The storefront's /store-api URL is accepted too.
    const pages = await run(shopwareAccountAdapter, 'customers', `${SHOP}/store-api`, { credentials, fetch: fetcher, currency: 'EUR' })
    expect(pages.map(entry => entry.items.length)).toEqual([100, 50])
    expect(fetcher.calls.map(call => call.body?.page)).toEqual([undefined, 1, 2])
  })

  it('caps the criteria limit at --limit and stops there', async () => {
    const fetcher = fakeFetch({
      [`POST ${SHOP}/api/oauth/token`]: shopwareToken,
      [`POST ${SHOP}/api/search/customer`]: (call: Call) => {
        expect(call.body).toMatchObject({ page: 1, limit: 2 })
        return json({ total: 3, data: shopwareCustomers.data.slice(0, 2) })
      },
    }, authorized)
    const pages = await run(shopwareAccountAdapter, 'customers', SHOP, { credentials, fetch: fetcher, limit: 2 })
    expect(pages.flatMap(entry => entry.items)).toHaveLength(2)
    expect(fetcher.calls).toHaveLength(2)
  })

  it('stops at total without asking for a page past it', async () => {
    const fetcher = fakeFetch({
      [`POST ${SHOP}/api/oauth/token`]: shopwareToken,
      [`POST ${SHOP}/api/search/order`]: (call: Call) => {
        expect(call.body.page).toBe(1)
        expect(Object.keys(call.body.associations)).toEqual(['lineItems', 'addresses', 'currency', 'stateMachineState', 'orderCustomer', 'deliveries', 'transactions'])
        // Transactions are read for their state only, never payment details.
        expect(call.body.includes.order_transaction).toEqual(['stateMachineState', 'createdAt'])
        return json(shopwareOrders)
      },
    }, authorized)

    const pages = await run(shopwareAccountAdapter, 'orders', SHOP, { credentials, fetch: fetcher })
    expect(pages[0]!.url).toBe(`${SHOP}/api/search/order (page 1)`)
    expect(pages[0]!.items.map((order: any) => order.number)).toEqual(['10042', '10043'])
    expect(fetcher.calls).toHaveLength(2)
  })

  it('renews an expired token once and repeats the request', async () => {
    const fetcher = fakeFetch({
      [`POST ${SHOP}/api/oauth/token`]: [shopwareToken, { ...shopwareToken, access_token: 'renewed-token' }],
      [`POST ${SHOP}/api/search/order`]: (call: Call) => call.headers.authorization === 'Bearer renewed-token'
        ? json({ total: 0, data: [] })
        : json({ errors: [{ status: '401', title: 'Unauthorized', detail: 'The resource owner or authorization server denied the request.' }] }, {}, 401),
    }, authorized)

    expect(await run(shopwareAccountAdapter, 'orders', SHOP, { credentials, fetch: fetcher })).toEqual([])
    expect(fetcher.calls.map(call => call.url.replace(SHOP, ''))).toEqual(['/api/oauth/token', '/api/search/order', '/api/oauth/token', '/api/search/order'])
  })

  it('reports rejected integration credentials without repeating the secret', async () => {
    const fetcher = fakeFetch({
      [`POST ${SHOP}/api/oauth/token`]: () => json({ errors: [{ title: 'The user credentials were incorrect.', detail: 'client_secret fixture-secret-0000000000000000000000000001' }] }, {}, 401),
    }, authorized)
    const error = await failure(run(shopwareAccountAdapter, 'customers', SHOP, { credentials, fetch: fetcher }))
    expect(error).toBeInstanceOf(AdminCredentialError)
    expect(error.message).toContain(`${SHOP}/api/oauth/token responded 401`)
    expect(error.message).toContain('SHOPWARE_CLIENT_ID and SHOPWARE_CLIENT_SECRET')
    expect(error.message).toContain('Settings > System > Integrations')
    expect(error.message).not.toContain('fixture-secret')
    expect(error.message).not.toContain('SWIAFIXTURECLIENTID0000001')
  })

  it('refuses plain HTTP except on this machine', async () => {
    const fetcher = fakeFetch({ [`POST http://localhost:8000/api/oauth/token`]: shopwareToken, [`POST http://localhost:8000/api/search/customer`]: { total: 0, data: [] } }, authorized)
    expect(await run(shopwareAccountAdapter, 'customers', 'http://localhost:8000', { credentials, fetch: fetcher })).toEqual([])

    const error = await failure(run(shopwareAccountAdapter, 'customers', 'http://shop.example.de', { credentials, fetch: fakeFetch({}, authorized) }))
    expect(error.message).toContain('is not HTTPS')
  })
})

describe('adapters refuse credentials for another platform', () => {
  it('before any request', async () => {
    const fetcher = fakeFetch({}, () => {})
    const shopify: AccountCredentials = { source: 'shopify', accessToken: 'shpat_x' }
    await expect(run(wooCommerceAccountAdapter, 'orders', 'https://example.com', { credentials: shopify, fetch: fetcher })).rejects.toThrow('WOOCOMMERCE_CONSUMER_KEY')
    await expect(run(shopwareAccountAdapter, 'orders', 'https://example.com', { credentials: shopify, fetch: fetcher })).rejects.toThrow('SHOPWARE_CLIENT_ID')
    expect(fetcher.calls).toHaveLength(0)
  })
})
