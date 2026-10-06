import type { SearchEngineDriver } from '@stacksjs/types'
import { afterEach, beforeAll, describe, expect, test } from 'bun:test'
import { searchEngine } from '@stacksjs/config'
import { searchEngineReady } from '@stacksjs/search-engine'
import meilisearch from '../../search-engine/src/drivers/meilisearch'
import opensearch from '../../search-engine/src/drivers/opensearch'
import typesense from '../../search-engine/src/drivers/typesense'
import { defineModel } from '../src/define-model'

/**
 * `Model.search()` through to the request a driver sends.
 *
 * The builder sends `{ q, limit, offset, filter }`. The Meilisearch driver read
 * `query`, `page` and `perPage` instead, so `Product.search('widget').get()`
 * returned the first twenty documents of the index and `.paginate(10, 3)`
 * returned page one every time; Typesense read `q` but not `limit` / `offset`.
 * And `removeAllFromSearch()` looked for a `deleteAllDocuments` no driver had,
 * then deleted only the ids still in the database, leaving every orphan.
 *
 * The configured driver's members are pointed at the driver under test, and
 * `fetch` is recorded; both are put back after each test.
 */

interface Recorded { method: string, url: string, body: any }

let driver: SearchEngineDriver
let restore: Array<() => void> = []

function recordFetch(respond: (r: Recorded) => Response): Recorded[] {
  const original = globalThis.fetch
  const requests: Recorded[] = []
  globalThis.fetch = (async (input: string | URL | Request, init?: RequestInit) => {
    const body = typeof init?.body === 'string' ? init.body : undefined
    let json: any
    try { json = body === undefined ? undefined : JSON.parse(body) }
    catch { json = body }
    const recorded = { method: init?.method ?? 'GET', url: String(input), body: json }
    requests.push(recorded)
    return respond(recorded)
  }) as typeof fetch
  restore.push(() => { globalThis.fetch = original })
  return requests
}

function routeSearchTo(target: SearchEngineDriver): void {
  // Taken before reassigning, in case the configured driver is the target.
  const original = driver.search
  const search = target.search
  driver.search = (index, params) => search(index, params)
  restore.push(() => { driver.search = original })
}

function setOption<K extends 'meilisearch' | 'typesense' | 'opensearch'>(key: K, value: (typeof searchEngine)[K]): void {
  const original = searchEngine[key]
  searchEngine[key] = value
  restore.push(() => { searchEngine[key] = original })
}

beforeAll(async () => {
  driver = await searchEngineReady()
})

afterEach(() => {
  for (const undo of restore.reverse()) undo()
  restore = []
  meilisearch.resetClient?.()
  typesense.resetClient?.()
})

const Gadget = defineModel({
  name: 'Gadget',
  table: 'gadgets',
  traits: {
    useSearch: { searchable: ['name'], filterable: ['status'], sortable: [], displayable: [] },
  },
  attributes: {
    name: { fillable: true },
    status: { fillable: true },
  },
} as const) as any

describe('Model.search() through the Meilisearch driver', () => {
  const meiliResponse = { hits: [{ id: 21 }], query: 'widget', processingTimeMs: 1, limit: 10, offset: 20, estimatedTotalHits: 31 }

  test('.get() searches for the query', async () => {
    setOption('meilisearch', { host: 'http://meili.example.test:7700', apiKey: 'k' })
    meilisearch.resetClient?.()
    routeSearchTo(meilisearch)
    const requests = recordFetch(() => Response.json(meiliResponse))

    await Gadget.search('widget').get()

    expect(requests).toHaveLength(1)
    expect(requests[0]!.url).toBe('http://meili.example.test:7700/indexes/gadgets/search')
    expect(requests[0]!.body).toEqual({ q: 'widget', limit: 20, offset: 0 })
  })

  test('.paginate(10, 3) asks for page 3', async () => {
    setOption('meilisearch', { host: 'http://meili.example.test:7700', apiKey: 'k' })
    meilisearch.resetClient?.()
    routeSearchTo(meilisearch)
    const requests = recordFetch(() => Response.json(meiliResponse))

    const page = await Gadget.search('widget').paginate(10, 3)

    expect(requests[0]!.body).toEqual({ q: 'widget', limit: 10, offset: 20 })
    expect(page).toEqual({ hits: [{ id: 21 }], total: 31, page: 3, perPage: 10 })
  })

  test('.where() with Meilisearch syntax passes through, and an object is escaped', async () => {
    setOption('meilisearch', { host: 'http://meili.example.test:7700', apiKey: 'k' })
    meilisearch.resetClient?.()
    routeSearchTo(meilisearch)
    const requests = recordFetch(() => Response.json(meiliResponse))

    await Gadget.search('widget').where('status = \'published\'').get()
    await Gadget.search('widget').where(['status = \'published\'', 'price > 10']).get()
    await Gadget.search('widget').where({ status: 'it\'s' }).get()

    expect(requests.map(r => r.body.filter)).toEqual([
      'status = \'published\'',
      ['status = \'published\'', 'price > 10'],
      ['status = \'it\\\'s\''],
    ])
  })
})

describe('Model.search() through the Typesense driver', () => {
  test('.paginate(10, 3) with a filter sends page 3, query_by and filter_by', async () => {
    setOption('typesense', { host: 'ts.example.test', port: 8108, protocol: 'http', apiKey: 'k' })
    typesense.resetClient?.()
    routeSearchTo(typesense)
    const requests = recordFetch(() => Response.json({ found: 31, hits: [{ document: { id: '21' } }], search_time_ms: 1 }))

    const page = await Gadget.search('widget').where('status:=published').paginate(10, 3)

    const url = new URL(requests[0]!.url)
    expect(`${url.origin}${url.pathname}`).toBe('http://ts.example.test:8108/collections/gadgets/documents/search')
    expect(Object.fromEntries(url.searchParams)).toEqual({
      q: 'widget',
      query_by: 'name',
      per_page: '10',
      page: '3',
      filter_by: 'status:=published',
    })
    expect(page).toEqual({ hits: [{ id: '21' }], total: 31, page: 3, perPage: 10 })
  })
})

describe('Model.removeAllFromSearch()', () => {
  test('empties the index through the driver\'s deleteAllDocuments', async () => {
    setOption('opensearch', { host: 'os.example.test', protocol: 'https', port: 9443, auth: '' })
    const original = driver.deleteAllDocuments
    const deleteAll = opensearch.deleteAllDocuments
    const calls: string[] = []
    driver.deleteAllDocuments = async (index: string) => {
      calls.push(index)
      return await deleteAll(index)
    }
    restore.push(() => { driver.deleteAllDocuments = original })
    const requests = recordFetch(() => Response.json({ deleted: 4 }))

    // No database is configured for `gadgets`: the old row-by-row fallback
    // would have had to query it.
    await Gadget.removeAllFromSearch()

    expect(calls).toEqual(['gadgets'])
    expect(requests.map(r => [r.method, r.url, r.body])).toEqual([
      ['POST', 'https://os.example.test:9443/gadgets/_delete_by_query?refresh=true', { query: { match_all: {} } }],
    ])
  })

  test('paginate() refuses a page that is not 1-based', async () => {
    await expect(Gadget.search('widget').paginate(10, 0)).rejects.toThrow(/1-based/)
  })
})
