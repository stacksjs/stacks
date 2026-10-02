import type { CatalogAdapter, CatalogPage, FetchLike } from '../imports'
import { describe, expect, it } from 'bun:test'
import { CatalogFetchError, shopifyAdapter, wooCommerceAdapter } from '../imports'
import shopifyFixture from './fixtures/catalog-import/shopify-products.json'
import wooProducts from './fixtures/catalog-import/woocommerce-products.json'
import wooVariations from './fixtures/catalog-import/woocommerce-variations.json'

/**
 * Paging through a store, against a fake `fetch`.
 *
 * Every route the fake answers is listed per test, and an unlisted URL fails
 * the test: that is how "stops at the end" and "asks for the right page" are
 * both checked, not just "returns the products".
 */

type Route = unknown | ((url: string) => Response)

function json(body: unknown, headers: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json', ...headers } })
}

function fakeFetch(routes: Record<string, Route>): FetchLike & { calls: string[] } {
  const calls: string[] = []
  const fetcher = (async (input: string) => {
    calls.push(input)
    if (!(input in routes))
      throw new Error(`unexpected request ${input}`)
    const route = routes[input]
    if (typeof route === 'function')
      return (route as (url: string) => Response)(input)
    if (route instanceof Response)
      return route
    return json(route)
  }) as FetchLike & { calls: string[] }
  fetcher.calls = calls
  return fetcher
}

async function collect(adapter: CatalogAdapter, url: string, options: Parameters<CatalogAdapter['pages']>[1]): Promise<CatalogPage[]> {
  const pages: CatalogPage[] = []
  for await (const page of adapter.pages(url, options))
    pages.push(page)
  return pages
}

const [tee, sleeve, sample] = shopifyFixture.products
const SHOP = 'https://shop.example.com'

describe('shopifyAdapter paging', () => {
  it('pages until an empty page, reading the currency from meta.json', async () => {
    const fetcher = fakeFetch({
      [`${SHOP}/meta.json`]: { name: 'Example', currency: 'cad' },
      [`${SHOP}/products.json?limit=250&page=1`]: { products: [tee, sleeve] },
      [`${SHOP}/products.json?limit=250&page=2`]: { products: [sample] },
      [`${SHOP}/products.json?limit=250&page=3`]: { products: [] },
    })

    const pages = await collect(shopifyAdapter, 'shop.example.com/', { fetch: fetcher })

    expect(pages.map(page => page.products.length)).toEqual([2, 1])
    expect(pages[0]!.products[0]!.currency).toBe('CAD')
    expect(pages[0]!.url).toBe(`${SHOP}/products.json?limit=250&page=1`)
    expect(fetcher.calls).toHaveLength(4)
  })

  it('imports nothing from an empty store, without error', async () => {
    const fetcher = fakeFetch({
      [`${SHOP}/products.json?limit=250&page=1`]: { products: [] },
    })

    expect(await collect(shopifyAdapter, SHOP, { fetch: fetcher, currency: 'usd' })).toEqual([])
    // An explicit currency skips the meta.json request.
    expect(fetcher.calls).toEqual([`${SHOP}/products.json?limit=250&page=1`])
  })

  it('asks for no more than --limit and stops once it has them', async () => {
    const fetcher = fakeFetch({
      [`${SHOP}/products.json?limit=2&page=1`]: { products: [tee, sleeve] },
    })

    const pages = await collect(shopifyAdapter, SHOP, { fetch: fetcher, currency: 'USD', limit: 2 })
    expect(pages.flatMap(page => page.products).map(product => product.externalId)).toEqual(['7612345678901', '7612345678902'])
    expect(fetcher.calls).toHaveLength(1)
  })

  it('warns when the currency is unknown, once', async () => {
    const fetcher = fakeFetch({
      [`${SHOP}/meta.json`]: () => new Response('not found', { status: 404 }),
      [`${SHOP}/products.json?limit=250&page=1`]: { products: [sleeve] },
      [`${SHOP}/products.json?limit=250&page=2`]: { products: [] },
    })

    const pages = await collect(shopifyAdapter, SHOP, { fetch: fetcher })
    expect(pages[0]!.warnings.map(warning => warning.message)).toEqual([
      `${SHOP}/meta.json did not report a currency; prices read as 2-decimal amounts. Pass --currency to be sure.`,
    ])
    expect(pages[0]!.products[0]!.currency).toBeNull()
  })

  it('stops instead of looping when the store ignores the page parameter', async () => {
    const fetcher = fakeFetch({
      [`${SHOP}/products.json?limit=250&page=1`]: { products: [tee] },
      [`${SHOP}/products.json?limit=250&page=2`]: { products: [tee] },
    })

    await expect(collect(shopifyAdapter, SHOP, { fetch: fetcher, currency: 'USD' })).rejects.toThrow('not paginating')
  })

  it('fails loudly, naming the URL, on a network error', async () => {
    const fetcher = fakeFetch({
      [`${SHOP}/products.json?limit=250&page=1`]: () => {
        throw new TypeError('getaddrinfo ENOTFOUND shop.example.com')
      },
    })

    const error = await collect(shopifyAdapter, SHOP, { fetch: fetcher, currency: 'USD' }).catch(caught => caught)
    expect(error).toBeInstanceOf(CatalogFetchError)
    expect(error.message).toContain(`Could not reach ${SHOP}/products.json?limit=250&page=1`)
    expect(error.message).toContain('ENOTFOUND')
  })

  it('names the URL and the likely cause on a password-protected store', async () => {
    const fetcher = fakeFetch({
      [`${SHOP}/products.json?limit=250&page=1`]: () => new Response('', { status: 401, statusText: 'Unauthorized' }),
    })

    await expect(collect(shopifyAdapter, SHOP, { fetch: fetcher, currency: 'USD' }))
      .rejects.toThrow(`${SHOP}/products.json?limit=250&page=1 responded 401 Unauthorized. Is this a Shopify storefront, and is it public (no storefront password)?`)
  })

  it('rejects a page that is not a Shopify products list', async () => {
    const html = fakeFetch({
      [`${SHOP}/products.json?limit=250&page=1`]: () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    })
    await expect(collect(shopifyAdapter, SHOP, { fetch: html, currency: 'USD' })).rejects.toThrow('did not return JSON (text/html)')

    const wrongShape = fakeFetch({ [`${SHOP}/products.json?limit=250&page=1`]: { items: [] } })
    await expect(collect(shopifyAdapter, SHOP, { fetch: wrongShape, currency: 'USD' })).rejects.toThrow('did not return a "products" list')
  })

  it('skips a malformed product with a warning and keeps the rest', async () => {
    const fetcher = fakeFetch({
      [`${SHOP}/products.json?limit=250&page=1`]: { products: [{ id: 1, title: '' }, sleeve] },
      [`${SHOP}/products.json?limit=250&page=2`]: { products: [] },
    })

    const [page] = await collect(shopifyAdapter, SHOP, { fetch: fetcher, currency: 'USD' })
    expect(page!.products.map(product => product.name)).toEqual(['Gift Card Sleeve'])
    expect(page!.warnings).toEqual([{ externalId: '1', message: 'skipped: Shopify product 1 has no title' }])
  })
})

const WOO = 'https://shop.example.co.uk'
const API = `${WOO}/wp-json/wc/store/v1/products`
const [hoodie, vneck, collection] = wooProducts

describe('wooCommerceAdapter paging', () => {
  it('follows X-WP-TotalPages and fetches one page of variations per page of parents', async () => {
    const fetcher = fakeFetch({
      [`${API}?per_page=100&page=1`]: json([hoodie, vneck], { 'x-wp-totalpages': '2', 'x-wp-total': '3' }),
      [`${API}?type=variation&parent=90&per_page=100&page=1`]: json(wooVariations, { 'x-wp-totalpages': '1' }),
      [`${API}?per_page=100&page=2`]: json([collection], { 'x-wp-totalpages': '2', 'x-wp-total': '3' }),
    })

    const pages = await collect(wooCommerceAdapter, WOO, { fetch: fetcher })

    expect(pages.map(page => page.products.map(product => product.externalId))).toEqual([['81', '90'], ['99']])
    expect(pages[0]!.products[1]!.variants.map(variant => variant.priceMinor)).toEqual([2000, 1500])
    // No request for page 3: the header said there were two.
    expect(fetcher.calls).toHaveLength(3)
  })

  it('pages until empty when the header is missing', async () => {
    const fetcher = fakeFetch({
      [`${API}?per_page=100&page=1`]: [hoodie],
      [`${API}?per_page=100&page=2`]: [],
    })

    const pages = await collect(wooCommerceAdapter, WOO, { fetch: fetcher })
    expect(pages).toHaveLength(1)
    expect(fetcher.calls).toHaveLength(2)
  })

  it('keeps a WordPress subdirectory in the API path', async () => {
    const fetcher = fakeFetch({
      'https://example.com/shop/wp-json/wc/store/v1/products?per_page=100&page=1': json([], { 'x-wp-totalpages': '0' }),
    })

    expect(await collect(wooCommerceAdapter, 'https://example.com/shop/', { fetch: fetcher })).toEqual([])
  })

  it('honours --limit, and fetches variations only for the products it keeps', async () => {
    const fetcher = fakeFetch({
      [`${API}?per_page=1&page=1`]: json([hoodie], { 'x-wp-totalpages': '3' }),
    })

    const pages = await collect(wooCommerceAdapter, WOO, { fetch: fetcher, limit: 1 })
    expect(pages.flatMap(page => page.products).map(product => product.name)).toEqual([`Hoodie & Logo ${String.fromCodePoint(0x2013)} Navy`])
    expect(fetcher.calls).toHaveLength(1)
  })

  it('imports variable products unpriced when the variation query is refused', async () => {
    const fetcher = fakeFetch({
      [`${API}?per_page=100&page=1`]: json([vneck], { 'x-wp-totalpages': '1' }),
      [`${API}?type=variation&parent=90&per_page=100&page=1`]: () => new Response('{"code":"rest_invalid_param"}', { status: 400, statusText: 'Bad Request' }),
    })

    const [page] = await collect(wooCommerceAdapter, WOO, { fetch: fetcher })
    expect(page!.products[0]!.variants.map(variant => variant.priceMinor)).toEqual([null, null])
    expect(page!.warnings[0]!.message).toContain('variations could not be fetched')
    expect(page!.warnings[0]!.message).toContain('responded 400 Bad Request')
  })

  it('fails loudly, naming the URL, when the Store API is missing', async () => {
    const fetcher = fakeFetch({
      [`${API}?per_page=100&page=1`]: () => new Response('<html>Not Found</html>', { status: 404, statusText: 'Not Found' }),
    })

    await expect(collect(wooCommerceAdapter, WOO, { fetch: fetcher }))
      .rejects.toThrow(`${API}?per_page=100&page=1 responded 404 Not Found. Is WooCommerce 6+ installed with the Store API reachable at /wp-json?`)
  })
})
