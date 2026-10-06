import type { FetchStub } from './fixtures/fetch-stub'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import algolia, { configure as configureAlgolia } from '../src/drivers/algolia'
import meilisearch from '../src/drivers/meilisearch'
import opensearch from '../src/drivers/opensearch'
import typesense from '../src/drivers/typesense'
import { stubFetch } from './fixtures/fetch-stub'

const SRC = join(import.meta.dir, '..', 'src')
const CONTRACT = join(import.meta.dir, '..', '..', 'types', 'src', 'search-engine.ts')

/** The members `SearchEngineDriver` requires, read from its declaration. */
function contractMembers(): string[] {
  const source = readFileSync(CONTRACT, 'utf-8')
  const body = source.slice(source.indexOf('export interface SearchEngineDriver {'))
  const block = body.slice(0, body.indexOf('\n}\n'))
  return [...block.matchAll(/^ {2}(\w+)(\?)?:/gm)].filter(m => !m[2]).map(m => m[1]!)
}

/**
 * Every driver has the whole contract.
 *
 * The Algolia default export had almost none of it - no `addDocument`, no
 * `updateSettings`, no `deleteDocument` - and the driver binding cast it to
 * `SearchEngineDriver`, so `tsc` never said so and every model save with
 * Algolia selected failed with "has no method". Each default export is now
 * declared as `SearchEngineDriver`, so the compiler enforces this; the test
 * holds it at runtime too, and against the interface as it changes.
 */
describe('the SearchEngineDriver contract', () => {
  const members = contractMembers()

  test('is read from the interface', () => {
    expect(members).toContain('search')
    expect(members).toContain('deleteAllDocuments')
    expect(members.length).toBeGreaterThan(40)
  })

  for (const [name, driver] of Object.entries({ meilisearch, typesense, opensearch, algolia })) {
    test(`${name} implements every member`, () => {
      const missing = members.filter(member => typeof (driver as unknown as Record<string, unknown>)[member] !== 'function')
      expect(missing).toEqual([])
    })
  }

  test('the driver binding no longer casts its way past the type', () => {
    const index = readFileSync(join(SRC, 'index.ts'), 'utf-8')
    expect(index).toContain('resolvedDriver = driverModule.default\n')
    expect(index).not.toMatch(/driverModule\.default as /)
  })

  test('every driver module declares its default export as SearchEngineDriver', () => {
    for (const file of ['meilisearch', 'typesense', 'opensearch', 'algolia']) {
      const source = readFileSync(join(SRC, 'drivers', `${file}.ts`), 'utf-8')
      expect(source).toMatch(/^const \w+: SearchEngineDriver = \{/m)
    }
  })
})

describe('Algolia driver', () => {
  let fetchStub: FetchStub | undefined
  const BASE = 'https://APPID.algolia.net'

  beforeEach(() => {
    configureAlgolia({ appId: 'APPID', apiKey: 'admin-key' })
  })

  afterEach(() => {
    fetchStub?.restore()
    fetchStub = undefined
    algolia.resetClient?.()
  })

  test('search speaks the shared contract: page 3 of 10 is Algolia page 2', async () => {
    fetchStub = stubFetch(() => Response.json({ hits: [{ objectID: '21', id: 21 }], nbHits: 31, page: 2, nbPages: 4, hitsPerPage: 10, processingTimeMS: 3, query: 'widget', params: '' }))

    const result = await algolia.search('products', { q: 'widget', query_by: 'name', limit: 10, offset: 20, filter: { status: 'published', price: 10 } })

    const request = fetchStub.requests[0]!
    expect([request.method, request.url]).toEqual(['POST', `${BASE}/1/indexes/products/query`])
    expect(request.headers['x-algolia-api-key']).toBe('admin-key')
    expect(request.json).toEqual({ query: 'widget', page: 2, hitsPerPage: 10, filters: 'status:"published" AND price = 10' })
    expect(result).toMatchObject({ limit: 10, offset: 20, estimatedTotalHits: 31, processingTimeMs: 3 })
  })

  test('an offset off a page boundary is sent as offset / length', async () => {
    fetchStub = stubFetch(() => Response.json({ hits: [], nbHits: 0, processingTimeMS: 1, query: '' }))

    await algolia.search('products', { limit: 10, offset: 5, filter: 'brand:acme' })

    expect(fetchStub.requests[0]!.json).toEqual({ query: '', offset: 5, length: 10, filters: 'brand:acme' })
  })

  test('addDocuments keys each record by its id', async () => {
    fetchStub = stubFetch(() => Response.json({ taskID: 7, objectIDs: ['1', '2'] }))

    const task = await algolia.addDocuments('products', [{ id: 1, name: 'Desk' }, { id: 2, name: 'Lamp' }])

    const request = fetchStub.requests[0]!
    expect([request.method, request.url]).toEqual(['POST', `${BASE}/1/indexes/products/batch`])
    expect(request.json).toEqual({
      requests: [
        { action: 'updateObject', body: { id: 1, name: 'Desk', objectID: '1' } },
        { action: 'updateObject', body: { id: 2, name: 'Lamp', objectID: '2' } },
      ],
    })
    expect(task.taskUid).toBe(7)
  })

  test('addDocument replaces the record at its objectID', async () => {
    fetchStub = stubFetch(() => Response.json({ taskID: 8 }))

    await algolia.addDocument('products', { id: 3, name: 'Chair' })

    const request = fetchStub.requests[0]!
    expect([request.method, request.url]).toEqual(['PUT', `${BASE}/1/indexes/products/3`])
    expect(request.json).toEqual({ id: 3, name: 'Chair', objectID: '3' })
  })

  test('deleteDocument, deleteDocuments and deleteAllDocuments', async () => {
    fetchStub = stubFetch(() => Response.json({ taskID: 9 }))

    await algolia.deleteDocument('products', 3)
    await algolia.deleteDocuments('products', ['status:draft', 'price < 1'])
    await algolia.deleteAllDocuments('products')

    expect(fetchStub.requests.map(r => [r.method, r.url, r.json])).toEqual([
      ['DELETE', `${BASE}/1/indexes/products/3`, undefined],
      ['POST', `${BASE}/1/indexes/products/deleteByQuery`, { filters: '(status:draft) AND (price < 1)' }],
      ['POST', `${BASE}/1/indexes/products/clear`, undefined],
    ])
  })

  test('updateSettings maps the model settings onto Algolia\'s, and skips sortable', async () => {
    fetchStub = stubFetch(() => Response.json({ taskID: 10, updatedAt: '2026-01-01T00:00:00Z' }))

    await algolia.updateSettings('products', {
      searchableAttributes: ['name', 'brand'],
      filterableAttributes: ['status'],
      sortableAttributes: ['price'],
      displayedAttributes: ['*'],
    })

    const request = fetchStub.requests[0]!
    expect([request.method, request.url]).toEqual(['PUT', `${BASE}/1/indexes/products/settings`])
    expect(request.json).toEqual({
      searchableAttributes: ['name', 'brand'],
      attributesForFaceting: ['status'],
      attributesToRetrieve: null,
    })
  })

  test('getSettings reads Algolia\'s settings back in the contract\'s shape', async () => {
    fetchStub = stubFetch(() => Response.json({
      searchableAttributes: ['unordered(name)', 'brand'],
      attributesForFaceting: ['filterOnly(status)', 'searchable(brand)'],
      ranking: ['typo', 'words', 'exact', 'desc(popularity)'],
    }))

    const settings = await algolia.getSettings('products')

    expect(settings.searchableAttributes).toEqual(['name', 'brand'])
    expect(settings.filterableAttributes).toEqual(['status', 'brand'])
    expect(settings.rankingRules).toEqual(['typo', 'words', 'exactness', 'popularity:desc'])
  })

  test('what Algolia cannot do fails clearly instead of being missing', async () => {
    fetchStub = stubFetch()

    await expect(algolia.updateSortableAttributes('products', ['price'])).rejects.toThrow(/not supported by Algolia.*replica/)
    await expect(algolia.search('products', { sort: 'price:asc' })).rejects.toThrow(/not supported by Algolia/)
    await expect(algolia.getDictionary('products')).rejects.toThrow(/not supported by Algolia/)
    expect(fetchStub.requests).toHaveLength(0)
  })
})
