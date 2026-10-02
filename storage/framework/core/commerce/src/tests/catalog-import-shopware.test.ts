import type { CatalogPage, FetchLike, ShopwareProductPayload } from '../imports'
import { describe, expect, it } from 'bun:test'
import {
  catalogAdapter,
  CatalogFetchError,
  catalogUuid,
  createMemoryRepository,
  importCatalog,
  mapShopwareProduct,
  shopwareAdapter,
  shopwareBaseUrl,
} from '../imports'
import shopwareContext from './fixtures/catalog-import/shopware-context.json'
import shopwareProducts from './fixtures/catalog-import/shopware-products.json'
import shopwareVariants from './fixtures/catalog-import/shopware-variants.json'

/**
 * Shopware 6 through the Store API: mapping recorded responses, and paging
 * against a fake `fetch` that checks every request's method, header and body.
 *
 * The fixtures follow the Store API schema (shopware/frontends
 * `storeApiSchema.json`) and what Shopware's public demo sales channel returns
 * for the same criteria, trimmed by the adapter's own `includes`.
 */

const parents = shopwareProducts.elements as unknown as ShopwareProductPayload[]
const children = shopwareVariants.elements as unknown as ShopwareProductPayload[]
const [shirt, cups, swatch, voucher] = parents

const SHOP = 'https://shop.example.de'
const API = `${SHOP}/store-api`
const KEY = 'SWSCEXAMPLEPUBLICKEY000000'
const context = { storeUrl: SHOP, currency: 'EUR' }

describe('mapShopwareProduct', () => {
  it('maps a parent and its variants, with translated names and option groups in group order', () => {
    const { product, warnings } = mapShopwareProduct(shirt!, { ...context, children })

    expect(warnings).toEqual([])
    expect(product).toMatchObject({
      source: 'shopware',
      externalId: '0190a1b2c3d47e8f9a0b1c2d3e4f5a61',
      // `translated` wins over the default-language field, whitespace collapsed.
      name: 'Leinenhemd Classic',
      handle: 'leinenhemd-classic',
      descriptionHtml: '<p>Luftiges Hemd aus <strong>100% Leinen</strong>.</p>',
      vendor: 'Nordlicht Textil',
      categories: [{ name: 'Hemden & Blusen', slug: 'hemden-and-blusen' }, { name: 'Sommer', slug: 'sommer' }],
      tags: ['linen', 'summer'],
      currency: 'EUR',
      // Größe has group position 1, Farbe 2, whatever order the options arrived in.
      optionNames: ['Größe', 'Farbe'],
      hasOptions: true,
      url: `${SHOP}/detail/0190a1b2c3d47e8f9a0b1c2d3e4f5a61`,
    })
  })

  it('reads variant prices from decimal numbers into integer cents, with list price and stock', () => {
    const { product } = mapShopwareProduct(shirt!, { ...context, children })

    expect(product.variants).toEqual([
      { externalId: '0190a1b2c3d47e8f9a0b1c2d3e4f5b01', title: 'S / Weiß', sku: 'SW10001.1', priceMinor: 4990, compareAtMinor: 5990, available: true, inventory: 8, optionValues: ['S', 'Weiß'] },
      // An empty `translated` ([] in Shopware's JSON) falls back to the option's own name.
      { externalId: '0190a1b2c3d47e8f9a0b1c2d3e4f5b02', title: 'S / Navy', sku: 'SW10001.2', priceMinor: 4990, compareAtMinor: null, available: false, inventory: 0, optionValues: ['S', 'Navy'] },
      // 1999.5 is 1999.50 EUR; availableStock (sellable) is read over stock.
      { externalId: '0190a1b2c3d47e8f9a0b1c2d3e4f5b03', title: 'L / Weiß', sku: 'SW10001.3', priceMinor: 199950, compareAtMinor: null, available: true, inventory: 2, optionValues: ['L', 'Weiß'] },
    ])
  })

  it('puts the cover first, keeps media order, and drops duplicates and empty media', () => {
    const { product } = mapShopwareProduct(shirt!, { ...context, children })
    expect(product.images).toEqual([
      { src: 'https://cdn.shop.example.de/media/a1/b2/c3/shirt-front.jpg?ts=1717000000', alt: 'Leinenhemd, vorne' },
      // No alt text: the media title stands in.
      { src: 'https://cdn.shop.example.de/media/d4/e5/f6/shirt-back.jpg?ts=1717000000', alt: 'Back' },
    ])
  })

  it('maps a product without variants as its own single variant, with its list price as compare-at', () => {
    const { product, warnings } = mapShopwareProduct(cups!, context)

    expect(warnings).toEqual([])
    // An empty `translated` falls back to the default-language fields.
    expect(product.name).toBe('Espresso Cup Set')
    expect(product.descriptionHtml).toBe('<ul><li>2 cups</li><li>Dishwasher safe</li></ul>')
    expect(product.vendor).toBe('Porzellan Werk')
    // The SEO category is the main one, and is not repeated.
    expect(product.categories).toEqual([{ name: 'Küche', slug: 'kuche' }, { name: 'Geschenke', slug: 'geschenke' }])
    expect(product.hasOptions).toBe(false)
    expect(product.optionNames).toEqual([])
    expect(product.variants).toEqual([
      { externalId: '0190a1b2c3d47e8f9a0b1c2d3e4f5a62', title: 'Espresso Cup Set', sku: 'SW10002', priceMinor: 1999, compareAtMinor: 2499, available: true, inventory: 10, optionValues: [] },
    ])
  })

  it('reads 0.1 as ten cents, clamps oversold stock to zero, and ignores a list price below the price', () => {
    const { product } = mapShopwareProduct(swatch!, context)

    expect(product.name).toBe('Muster: Stoffprobe')
    expect(product.descriptionHtml).toBeNull()
    expect(product.vendor).toBeNull()
    expect(product.tags).toEqual([])
    expect(product.images).toEqual([])
    expect(product.variants[0]).toMatchObject({ priceMinor: 10, compareAtMinor: null, inventory: 0, available: true })
  })

  it('leaves a product with no price in the sales channel currency unpriced, and says so', () => {
    const { product, warnings } = mapShopwareProduct(voucher!, context)

    expect(product.variants[0]).toMatchObject({ priceMinor: null, compareAtMinor: null, available: false })
    expect(warnings).toEqual([{ externalId: '0190a1b2c3d47e8f9a0b1c2d3e4f5a64', message: '"Gutschein (Preis auf Anfrage)" has no price in EUR; left unpriced' }])
  })

  it('leaves an unreadable price unpriced with a warning instead of guessing', () => {
    const negative = { ...cups!, calculatedPrice: { unitPrice: -5 } }
    const { product, warnings } = mapShopwareProduct(negative, context)
    expect(product.variants[0]!.priceMinor).toBeNull()
    expect(warnings[0]!.message).toContain('Unreadable price -5')
  })

  it('converts at the currency precision', () => {
    const yen = { ...cups!, calculatedPrice: { unitPrice: 1999, listPrice: null } }
    expect(mapShopwareProduct(yen, { ...context, currency: 'JPY' }).product.variants[0]!.priceMinor).toBe(1999)
    const dinar = { ...cups!, calculatedPrice: { unitPrice: 12.345, listPrice: null } }
    expect(mapShopwareProduct(dinar, { ...context, currency: 'KWD' }).product.variants[0]!.priceMinor).toBe(12345)
  })

  it('imports a parent whose variants are all hidden without a price, and says why', () => {
    const { product, warnings } = mapShopwareProduct(shirt!, context)
    expect(product.variants).toEqual([])
    expect(product.hasOptions).toBe(false)
    expect(warnings[0]!.message).toBe('"Leinenhemd Classic" has 3 variants in Shopware, none visible to this sales channel; imported without a price')
  })

  it('rejects a product without an id or a name', () => {
    expect(() => mapShopwareProduct({ id: '' }, context)).toThrow('has no id')
    expect(() => mapShopwareProduct({ id: 'abc', name: ' ', translated: [] }, context)).toThrow('Shopware product abc has no name')
  })
})

describe('shopwareBaseUrl', () => {
  it('accepts the storefront or the Store API endpoint', () => {
    expect(shopwareBaseUrl('shop.example.de/')).toBe(SHOP)
    expect(shopwareBaseUrl('https://shop.example.de/store-api/')).toBe(SHOP)
    expect(shopwareBaseUrl('https://example.de/de/store-api')).toBe('https://example.de/de')
  })
})

interface Call {
  url: string
  method: string
  headers: Record<string, string>
  body: any
}

type Route = (call: Call) => unknown

function json(body: unknown, status = 200, statusText = 'OK'): Response {
  return new Response(JSON.stringify(body), { status, statusText, headers: { 'content-type': 'application/json' } })
}

/**
 * A fake Store API. Each route answers by method and URL; an unlisted request
 * fails the test. The parent-or-variant split is read from the criteria body.
 */
function fakeStoreApi(routes: Record<string, Route>): FetchLike & { calls: Call[] } {
  const calls: Call[] = []
  const fetcher = (async (input: string, init?: RequestInit) => {
    const headers = Object.fromEntries(new Headers(init?.headers).entries())
    const call: Call = { url: input, method: init?.method ?? 'GET', headers, body: init?.body ? JSON.parse(String(init.body)) : undefined }
    calls.push(call)
    const route = routes[`${call.method} ${input}`]
    if (!route)
      throw new Error(`unexpected request ${call.method} ${input}`)
    const answer = route(call)
    return answer instanceof Response ? answer : json(answer)
  }) as FetchLike & { calls: Call[] }
  fetcher.calls = calls
  return fetcher
}

const isVariantQuery = (call: Call) => call.body?.filter?.[0]?.field === 'parentId' && call.body.filter[0].type === 'equalsAny'

async function collect(url: string, options: Parameters<typeof shopwareAdapter.pages>[1]): Promise<CatalogPage[]> {
  const pages: CatalogPage[] = []
  for await (const page of shopwareAdapter.pages(url, options))
    pages.push(page)
  return pages
}

describe('shopwareAdapter paging', () => {
  it('is registered under --from shopware', () => {
    expect(catalogAdapter('Shopware')).toBe(shopwareAdapter)
  })

  it('refuses to start without an access key, before any request, and says where to find it', async () => {
    const fetcher = fakeStoreApi({})
    const error = await collect(SHOP, { fetch: fetcher }).catch(caught => caught)
    expect(error.message).toContain('pass --access-key <key> or set SHOPWARE_ACCESS_KEY')
    expect(error.message).toContain('Sales Channels')
    expect(error.message).toContain('"API access"')
    expect(fetcher.calls).toEqual([])
    await expect(collect(SHOP, { fetch: fetcher, accessKey: '   ' })).rejects.toThrow('--access-key')
  })

  it('sends the key on every request, reads the currency from the context, and pages parents then their variants', async () => {
    // 104 parents: a full page of 100, then a short page of 4.
    const catalog = [...parents, ...Array.from({ length: 100 }, (_, i) => ({ ...cups!, id: `p${String(i).padStart(31, '0')}` }))]
    const fetcher = fakeStoreApi({
      [`GET ${API}/context`]: () => shopwareContext,
      [`POST ${API}/product`]: (call) => {
        if (isVariantQuery(call))
          return shopwareVariants
        const start = (call.body.page - 1) * call.body.limit
        return { ...shopwareProducts, total: catalog.length, page: call.body.page, limit: call.body.limit, elements: catalog.slice(start, start + call.body.limit) }
      },
    })

    const pages = await collect(`${SHOP}/store-api`, { fetch: fetcher, accessKey: KEY })

    expect(pages.map(page => page.products.length)).toEqual([100, 4])
    expect(pages[0]!.products[0]!.variants).toHaveLength(3)
    expect(pages.map(page => page.url)).toEqual([`${API}/product (page 1)`, `${API}/product (page 2)`])
    expect(pages[0]!.products[0]!.currency).toBe('EUR')

    // context, page 1, variants of page 1's one parent, page 2. Page 2 holds
    // no parent with variants, so no variant request, and 2 x 100 >= 104, so no page 3.
    expect(fetcher.calls.map(call => `${call.method} ${call.url}${isVariantQuery(call) ? ' (variants)' : call.body ? ` (page ${call.body.page})` : ''}`)).toEqual([
      `GET ${API}/context`,
      `POST ${API}/product (page 1)`,
      `POST ${API}/product (variants)`,
      `POST ${API}/product (page 2)`,
    ])
    for (const call of fetcher.calls) {
      expect(call.headers['sw-access-key']).toBe(KEY)
      expect(call.headers.accept).toBe('application/json')
    }
  })

  it('asks for no more than --limit and stops once it has them', async () => {
    const fetcher = fakeStoreApi({
      [`GET ${API}/context`]: () => shopwareContext,
      [`POST ${API}/product`]: call => isVariantQuery(call) ? shopwareVariants : { total: 4, elements: parents.slice(0, call.body.limit) },
    })

    const pages = await collect(SHOP, { fetch: fetcher, accessKey: KEY, limit: 2 })
    expect(pages.flatMap(page => page.products).map(product => product.name)).toEqual(['Leinenhemd Classic', 'Espresso Cup Set'])
    expect(fetcher.calls[1]!.body.limit).toBe(2)
    // context, page 1, the kept parent's variants; then no page 2.
    expect(fetcher.calls).toHaveLength(3)
  })

  it('asks for parents only, with the associations and includes the mapping reads', async () => {
    const fetcher = fakeStoreApi({
      [`GET ${API}/context`]: () => shopwareContext,
      [`POST ${API}/product`]: call => isVariantQuery(call) ? shopwareVariants : shopwareProducts,
    })

    await collect(SHOP, { fetch: fetcher, accessKey: KEY })

    const [, list, variants] = fetcher.calls
    expect(list!.headers['content-type']).toBe('application/json')
    expect(list!.body).toMatchObject({
      'page': 1,
      'limit': 100,
      'total-count-mode': 'exact',
      'filter': [{ type: 'equals', field: 'parentId', value: null }],
      'sort': [{ field: 'id', order: 'ASC' }],
      'associations': { cover: {}, media: { associations: { media: {} } }, manufacturer: {}, categories: {}, tags: {} },
    })
    expect(list!.body.includes.product).toEqual(expect.arrayContaining(['translated', 'calculatedPrice', 'productNumber', 'availableStock', 'childCount']))
    expect(list!.body.includes.calculated_price).toEqual(['unitPrice', 'quantity', 'listPrice'])

    expect(variants!.body).toMatchObject({
      'page': 1,
      'limit': 100,
      'filter': [{ type: 'equalsAny', field: 'parentId', value: ['0190a1b2c3d47e8f9a0b1c2d3e4f5a61'] }],
      'associations': { options: { associations: { group: {} } } },
    })
    // Four products on a page of 100 is the last page: no request for page 2.
    expect(fetcher.calls).toHaveLength(3)
  })

  it('pages the variants too when a page of parents has more than 100', async () => {
    const many = Array.from({ length: 150 }, (_, i) => ({ ...children[i % 3]!, id: `c${String(i).padStart(31, '0')}` }))
    const fetcher = fakeStoreApi({
      [`GET ${API}/context`]: () => shopwareContext,
      [`POST ${API}/product`]: (call) => {
        if (!isVariantQuery(call))
          return { ...shopwareProducts, total: 1, elements: [{ ...shirt!, childCount: 150 }] }
        const start = (call.body.page - 1) * 100
        return { ...shopwareVariants, total: 150, page: call.body.page, elements: many.slice(start, start + 100) }
      },
    })

    const [page] = await collect(SHOP, { fetch: fetcher, accessKey: KEY })
    expect(page!.products[0]!.variants).toHaveLength(150)
    expect(fetcher.calls.filter(isVariantQuery).map(call => call.body.page)).toEqual([1, 2])
  })

  it('pages until an empty page when the store reports no total', async () => {
    const fetcher = fakeStoreApi({
      [`GET ${API}/context`]: () => shopwareContext,
      [`POST ${API}/product`]: call => ({ elements: call.body.page === 1 ? Array.from({ length: 100 }, (_, i) => ({ ...cups!, id: `p${String(i).padStart(31, '0')}` })) : [] }),
    })

    const pages = await collect(SHOP, { fetch: fetcher, accessKey: KEY })
    expect(pages).toHaveLength(1)
    expect(pages[0]!.products).toHaveLength(100)
    expect(fetcher.calls.map(call => call.body?.page)).toEqual([undefined, 1, 2])
  })

  it('imports nothing from an empty sales channel, without error', async () => {
    const fetcher = fakeStoreApi({
      [`GET ${API}/context`]: () => shopwareContext,
      [`POST ${API}/product`]: () => ({ total: 0, elements: [] }),
    })
    expect(await collect(SHOP, { fetch: fetcher, accessKey: KEY })).toEqual([])
  })

  it('stops instead of looping when the store ignores the page parameter', async () => {
    const full = Array.from({ length: 100 }, (_, i) => ({ ...cups!, id: `p${String(i).padStart(31, '0')}` }))
    const fetcher = fakeStoreApi({
      [`GET ${API}/context`]: () => shopwareContext,
      [`POST ${API}/product`]: () => ({ elements: full }),
    })
    await expect(collect(SHOP, { fetch: fetcher, accessKey: KEY })).rejects.toThrow(`${API}/product (page 2) repeated products from an earlier page`)
  })

  it('names the URL and blames the key on a 401, a 403 or an unknown sales channel', async () => {
    const missing = fakeStoreApi({
      [`GET ${API}/context`]: () => json({ errors: [{ code: '0', status: '401', title: 'Unauthorized', detail: 'Header "sw-access-key" is required.' }] }, 401, 'Unauthorized'),
    })
    const error = await collect(SHOP, { fetch: missing, accessKey: KEY }).catch(caught => caught)
    expect(error).toBeInstanceOf(CatalogFetchError)
    expect(error.message).toContain(`${API}/context responded 401 Unauthorized.`)
    expect(error.message).toContain('Shopware said: "Header "sw-access-key" is required."')
    expect(error.message).toContain('The sales channel access key looks wrong: check --access-key or SHOPWARE_ACCESS_KEY.')
    // The key itself is never echoed back.
    expect(error.message).not.toContain(KEY)

    // This is what Shopware answers for a key that matches no sales channel.
    const wrong = fakeStoreApi({
      [`GET ${API}/context`]: () => json({ errors: [{ status: '412', code: 'FRAMEWORK__ROUTING_SALES_CHANNEL_NOT_FOUND', title: 'Precondition Failed', detail: 'No matching sales channel found.' }] }, 412, 'Precondition Failed'),
    })
    await expect(collect(SHOP, { fetch: wrong, accessKey: KEY })).rejects.toThrow('No matching sales channel found." The sales channel access key looks wrong')

    const forbidden = fakeStoreApi({
      [`GET ${API}/context`]: () => shopwareContext,
      [`POST ${API}/product`]: () => new Response('', { status: 403, statusText: 'Forbidden' }),
    })
    await expect(collect(SHOP, { fetch: forbidden, accessKey: KEY })).rejects.toThrow(`${API}/product (page 1) responded 403 Forbidden. The sales channel access key looks wrong`)
  })

  it('says the Store API is missing when the store has none', async () => {
    const fetcher = fakeStoreApi({
      [`GET ${API}/context`]: () => new Response('<html>Not Found</html>', { status: 404, statusText: 'Not Found' }),
      [`POST ${API}/product`]: () => new Response('<html>Not Found</html>', { status: 404, statusText: 'Not Found' }),
    })
    await expect(collect(SHOP, { fetch: fetcher, accessKey: KEY }))
      .rejects.toThrow(`${API}/product (page 1) responded 404 Not Found. Is this a Shopware 6 store with the Store API reachable at /store-api?`)

    const html = fakeStoreApi({
      [`GET ${API}/context`]: () => shopwareContext,
      [`POST ${API}/product`]: () => new Response('<html></html>', { status: 200, headers: { 'content-type': 'text/html' } }),
    })
    await expect(collect(SHOP, { fetch: html, accessKey: KEY })).rejects.toThrow('did not return JSON (text/html)')
  })

  it('falls back to --currency when the context will not say, and warns when neither does', async () => {
    const routes = {
      [`GET ${API}/context`]: () => new Response('', { status: 500, statusText: 'Internal Server Error' }),
      [`POST ${API}/product`]: () => ({ total: 1, elements: [cups] }),
    }

    const [withFlag] = await collect(SHOP, { fetch: fakeStoreApi(routes), accessKey: KEY, currency: 'chf' })
    expect(withFlag!.products[0]!.currency).toBe('CHF')
    expect(withFlag!.warnings).toEqual([])

    const [without] = await collect(SHOP, { fetch: fakeStoreApi(routes), accessKey: KEY })
    expect(without!.products[0]!.currency).toBeNull()
    expect(without!.warnings.map(warning => warning.message)).toEqual([`${API}/context did not report a currency; prices read as 2-decimal amounts. Pass --currency to be sure.`])
  })

  it('keeps the sales channel currency over a contradicting --currency, since the Store API cannot convert', async () => {
    const fetcher = fakeStoreApi({
      [`GET ${API}/context`]: () => shopwareContext,
      [`POST ${API}/product`]: () => ({ total: 1, elements: [cups] }),
    })
    const [page] = await collect(SHOP, { fetch: fetcher, accessKey: KEY, currency: 'USD' })
    expect(page!.products[0]!.currency).toBe('EUR')
    expect(page!.warnings[0]!.message).toBe('--currency USD ignored: this sales channel prices in EUR, and the Store API does not convert.')
  })

  it('skips a malformed product with a warning and keeps the rest', async () => {
    const fetcher = fakeStoreApi({
      [`GET ${API}/context`]: () => shopwareContext,
      [`POST ${API}/product`]: () => ({ total: 2, elements: [{ id: 'bad', translated: [], name: null }, cups] }),
    })
    const [page] = await collect(SHOP, { fetch: fetcher, accessKey: KEY })
    expect(page!.products.map(product => product.name)).toEqual(['Espresso Cup Set'])
    expect(page!.warnings).toEqual([{ externalId: 'bad', message: 'skipped: Shopware product bad has no name' }])
  })
})

describe('importCatalog from Shopware', () => {
  it('forwards the access key and keys rows on the shopware source and store host', async () => {
    const fetcher = fakeStoreApi({
      [`GET ${API}/context`]: () => shopwareContext,
      [`POST ${API}/product`]: call => isVariantQuery(call) ? shopwareVariants : shopwareProducts,
    })
    const repository = createMemoryRepository()

    const result = await importCatalog({ adapter: shopwareAdapter, storeUrl: SHOP, repository, fetch: fetcher, accessKey: KEY })

    expect(fetcher.calls.every(call => call.headers['sw-access-key'] === KEY)).toBe(true)
    expect(result.counts.products).toEqual({ created: 4, updated: 0 })
    expect(result.counts.variants).toEqual({ created: 3, updated: 0 })
    expect(result.currencies).toEqual(['EUR'])
    expect(repository.tables.products![0]).toMatchObject({
      uuid: catalogUuid('shopware', 'shop.example.de', 'product', '0190a1b2c3d47e8f9a0b1c2d3e4f5a61'),
      name: 'Leinenhemd Classic',
      price: 4990,
    })
    expect(repository.tables.product_variants!.map(row => [row.sku, row.price, row.compare_at_price, row.inventory_count, row.options])).toEqual([
      ['SW10001.1', 4990, 5990, 8, '["S","Weiß"]'],
      ['SW10001.2', 4990, null, 0, '["S","Navy"]'],
      ['SW10001.3', 199950, null, 2, '["L","Weiß"]'],
    ])

    // A second run updates in place.
    const again = await importCatalog({ adapter: shopwareAdapter, storeUrl: SHOP, repository, fetch: fetcher, accessKey: KEY })
    expect(again.counts.products).toEqual({ created: 0, updated: 4 })
    expect(again.counts.variants).toEqual({ created: 0, updated: 3 })
  })
})
