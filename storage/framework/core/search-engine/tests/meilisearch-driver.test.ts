import type { FetchStub } from './fixtures/fetch-stub'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { searchEngine } from '@stacksjs/config'
import meilisearch from '../src/drivers/meilisearch'
import { resolveSearchParams } from '../src/params'
import { stubFetch } from './fixtures/fetch-stub'

/**
 * The ORM's search builder sends `{ q, limit, offset, filter }`. This driver
 * read `query`, `page` and `perPage` and an object-shaped filter, so
 * `Product.search('widget').get()` searched for nothing and returned the first
 * twenty documents, `.paginate(10, 3)` returned page one every time, and
 * `.where("status = 'published'")` threw "unsafe field name: 0" because the
 * filter converter walked the string's indices.
 */

const originalOptions = searchEngine.meilisearch
let fetchStub: FetchStub | undefined

const searchResponse = { hits: [{ id: 1, name: 'Widget' }], query: 'widget', processingTimeMs: 1, limit: 10, offset: 20, estimatedTotalHits: 31 }

beforeEach(() => {
  searchEngine.meilisearch = { host: 'http://meili.example.test:7700', apiKey: 'master' }
  meilisearch.resetClient?.()
})

afterEach(() => {
  fetchStub?.restore()
  fetchStub = undefined
  searchEngine.meilisearch = originalOptions
  meilisearch.resetClient?.()
})

function lastSearchBody(): Record<string, unknown> {
  const request = fetchStub!.requests.at(-1)!
  expect(request.method).toBe('POST')
  expect(request.url).toBe('http://meili.example.test:7700/indexes/products/search')
  return request.json
}

describe('resolveSearchParams, the one reading of the contract', () => {
  test('page 3 of 10 is offset 20', () => {
    expect(resolveSearchParams({ q: 'w', perPage: 10, page: 3 })).toMatchObject({ query: 'w', limit: 10, offset: 20 })
  })

  test('limit / offset win over perPage / page', () => {
    expect(resolveSearchParams({ limit: 5, offset: 7, perPage: 10, page: 3 })).toMatchObject({ limit: 5, offset: 7 })
  })

  test('`query` is an alias of `q`, and nothing means match everything', () => {
    expect(resolveSearchParams({ query: 'desk' }).query).toBe('desk')
    expect(resolveSearchParams({}).query).toBe('')
    expect(resolveSearchParams({}).limit).toBe(20)
  })

  test('refuses a page that is not 1-based, and a negative offset', () => {
    expect(() => resolveSearchParams({ page: 0 })).toThrow(/1-based/)
    expect(() => resolveSearchParams({ offset: -1 })).toThrow(/non-negative/)
  })
})

describe('Meilisearch search', () => {
  test('sends q, limit and offset as the ORM builder gives them', async () => {
    fetchStub = stubFetch(() => Response.json(searchResponse))

    const result = await meilisearch.search('products', { q: 'widget', query_by: 'name', limit: 10, offset: 20 })

    // `query_by` is Typesense's; Meilisearch refuses a search carrying a key
    // it does not know, so it must not be forwarded.
    expect(lastSearchBody()).toEqual({ q: 'widget', limit: 10, offset: 20 })
    expect(result.estimatedTotalHits).toBe(31)
  })

  test('turns a 1-based page into an offset', async () => {
    fetchStub = stubFetch(() => Response.json(searchResponse))

    await meilisearch.search('products', { query: 'widget', perPage: 10, page: 3 })

    expect(lastSearchBody()).toEqual({ q: 'widget', limit: 10, offset: 20 })
  })

  test('passes a string filter through as Meilisearch syntax', async () => {
    fetchStub = stubFetch(() => Response.json(searchResponse))

    await meilisearch.search('products', { q: 'widget', filter: 'status = \'published\'' })

    expect(lastSearchBody().filter).toBe('status = \'published\'')
  })

  test('passes an array filter through, nested OR groups included', async () => {
    fetchStub = stubFetch(() => Response.json(searchResponse))

    await meilisearch.search('products', { q: '', filter: ['status = \'published\'', ['brand = \'a\'', 'brand = \'b\'']] })

    expect(lastSearchBody().filter).toEqual(['status = \'published\'', ['brand = \'a\'', 'brand = \'b\'']])
  })

  test('builds an object filter with quoted, escaped values', async () => {
    fetchStub = stubFetch(() => Response.json(searchResponse))

    await meilisearch.search('products', { q: '', filter: { status: 'it\'s', brand: ['a', 'b'], note: 'ends\\' } })

    expect(lastSearchBody().filter).toEqual([
      'status = \'it\\\'s\'',
      'brand IN [\'a\', \'b\']',
      // The backslash is escaped too, so it cannot swallow the closing quote.
      'note = \'ends\\\\\'',
    ])
  })

  test('still refuses an unsafe field name in an object filter', async () => {
    fetchStub = stubFetch(() => Response.json(searchResponse))

    await expect(meilisearch.search('products', { filter: { 'a\' OR 1=1': 'x' } })).rejects.toThrow(/unsafe field name/)
    expect(fetchStub.requests).toHaveLength(0)
  })

  test('accepts sort as engine syntax or as a map', async () => {
    fetchStub = stubFetch(() => Response.json(searchResponse))

    await meilisearch.search('products', { sort: 'price:asc' })
    expect(lastSearchBody().sort).toEqual(['price:asc'])

    await meilisearch.search('products', { sort: { price: 'desc' } })
    expect(lastSearchBody().sort).toEqual(['price:desc'])
  })
})

describe('Meilisearch deleteAllDocuments', () => {
  test('empties the index with DELETE /indexes/{uid}/documents', async () => {
    fetchStub = stubFetch(() => Response.json({ taskUid: 4, indexUid: 'products', status: 'enqueued', type: 'documentDeletion', enqueuedAt: '2026-01-01T00:00:00Z' }, { status: 202 }))

    await meilisearch.deleteAllDocuments('products')

    expect(fetchStub.requests.map(r => [r.method, r.url])).toEqual([
      ['DELETE', 'http://meili.example.test:7700/indexes/products/documents'],
    ])
  })
})
