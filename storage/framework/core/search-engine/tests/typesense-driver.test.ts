import type { FetchStub, RecordedRequest } from './fixtures/fetch-stub'
import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { searchEngine } from '@stacksjs/config'
import typesense from '../src/drivers/typesense'
import { stubFetch } from './fixtures/fetch-stub'

/**
 * The Typesense driver against a recorded `fetch`: the exact requests it sends,
 * and how it reads what comes back.
 */

const BASE = 'http://ts.example.test:8108'
const originalOptions = searchEngine.typesense
let fetchStub: FetchStub | undefined

beforeEach(() => {
  searchEngine.typesense = { host: 'ts.example.test', port: 8108, protocol: 'http', apiKey: 'key' }
  typesense.resetClient?.()
})

afterEach(() => {
  fetchStub?.restore()
  fetchStub = undefined
  searchEngine.typesense = originalOptions
  typesense.resetClient?.()
})

const emptySearch = () => Response.json({ found: 31, hits: [{ document: { id: '21', name: 'Widget' } }], search_time_ms: 2 })
const notFound = () => new Response('{"message":"Not Found"}', { status: 404 })

function searchQuery(): URLSearchParams {
  const request = fetchStub!.requests.at(-1)!
  expect(request.method).toBe('GET')
  const url = new URL(request.url)
  expect(`${url.origin}${url.pathname}`).toBe(`${BASE}/collections/products/documents/search`)
  return url.searchParams
}

describe('Typesense search', () => {
  test('page 3 of 10 from the builder\'s limit / offset', async () => {
    fetchStub = stubFetch(emptySearch)

    const result = await typesense.search('products', { q: 'widget', query_by: 'name', limit: 10, offset: 20 })

    const params = searchQuery()
    expect(params.get('q')).toBe('widget')
    expect(params.get('query_by')).toBe('name')
    expect(params.get('per_page')).toBe('10')
    expect(params.get('page')).toBe('3')
    expect(result).toMatchObject({ limit: 10, offset: 20, estimatedTotalHits: 31 })
  })

  test('an offset off a page boundary is sent as offset / limit', async () => {
    fetchStub = stubFetch(emptySearch)

    await typesense.search('products', { q: 'widget', query_by: 'name', limit: 10, offset: 5 })

    const params = searchQuery()
    expect(params.get('offset')).toBe('5')
    expect(params.get('limit')).toBe('10')
    expect(params.has('page')).toBe(false)
  })

  test('a string filter is Typesense syntax and passes through', async () => {
    fetchStub = stubFetch(emptySearch)

    await typesense.search('products', { q: 'widget', query_by: 'name', filter: 'status:=published && price:>10' })

    expect(searchQuery().get('filter_by')).toBe('status:=published && price:>10')
  })

  test('an array filter is clauses that must all hold', async () => {
    fetchStub = stubFetch(emptySearch)

    await typesense.search('products', { q: '', query_by: 'name', filter: ['status:=published', 'price:>10'] })

    const params = searchQuery()
    expect(params.get('filter_by')).toBe('status:=published && price:>10')
    expect(params.get('q')).toBe('*')
  })

  test('an object filter is quoted and escaped', async () => {
    fetchStub = stubFetch(emptySearch)

    await typesense.search('products', { q: '', query_by: ['name', 'brand'], filter: { status: 'pub`lished', brand: ['a', 'b'] } })

    const params = searchQuery()
    expect(params.get('query_by')).toBe('name,brand')
    expect(params.get('filter_by')).toBe('status:=`pub\\`lished` && brand:=[`a`,`b`]')
  })
})

describe('Typesense deleteDocuments', () => {
  test('deletes by filter instead of dropping the collection', async () => {
    fetchStub = stubFetch(() => Response.json({ num_deleted: 2 }))

    await typesense.deleteDocuments('products', 'status:=draft')

    expect(fetchStub.requests.map(r => [r.method, r.url])).toEqual([
      ['DELETE', `${BASE}/collections/products/documents?filter_by=status%3A%3Ddraft`],
    ])
  })

  test('joins several filters, and refuses none at all', async () => {
    fetchStub = stubFetch(() => Response.json({ num_deleted: 0 }))

    await typesense.deleteDocuments('products', ['status:=draft', 'price:<1'])
    expect(new URL(fetchStub.requests[0]!.url).searchParams.get('filter_by')).toBe('status:=draft && price:<1')

    await expect(typesense.deleteDocuments('products', [])).rejects.toThrow(/needs a filter/)
    expect(fetchStub.requests).toHaveLength(1)
  })
})

describe('Typesense deleteAllDocuments', () => {
  test('truncates the collection and keeps it', async () => {
    fetchStub = stubFetch(() => Response.json({ num_deleted: 9 }))

    await typesense.deleteAllDocuments('products')

    expect(fetchStub.requests.map(r => [r.method, r.url])).toEqual([
      ['DELETE', `${BASE}/collections/products/documents?truncate=true`],
    ])
  })

  test('a missing collection is already empty', async () => {
    fetchStub = stubFetch(notFound)

    await typesense.deleteAllDocuments('products')
  })
})

describe('Typesense deleteIndex', () => {
  test('ignores a collection that is already gone', async () => {
    fetchStub = stubFetch(notFound)

    await typesense.deleteIndex('products')
  })

  test('does not swallow any other failure', async () => {
    fetchStub = stubFetch(() => new Response('{"message":"Forbidden"}', { status: 401 }))

    await expect(Promise.resolve(typesense.deleteIndex('products'))).rejects.toThrow(/401/)
  })
})

describe('Typesense bulk import', () => {
  test('reports the lines Typesense refused behind its HTTP 200', async () => {
    fetchStub = stubFetch((request) => {
      if (request.method === 'GET')
        return Response.json({ name: 'products', fields: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string', facet: false, sort: false }, { name: 'price', type: 'int64', facet: false, sort: true }] })
      return new Response([
        '{"success":true}',
        '{"success":false,"error":"Field `price` must be an int64.","document":"{}"}',
      ].join('\n'))
    })

    await expect(typesense.addDocuments('products', [
      { id: 1, name: 'Desk', price: 100 },
      { id: 2, name: 'Lamp', price: 'cheap' },
    ])).rejects.toThrow('rejected 1 of 2 document(s): #2: Field `price` must be an int64.')
  })

  test('succeeds when every line says so', async () => {
    fetchStub = stubFetch((request) => {
      if (request.method === 'GET')
        return Response.json({ name: 'products', fields: [{ name: 'id', type: 'string' }, { name: 'name', type: 'string', facet: false }] })
      return new Response('{"success":true}\n{"success":true}')
    })

    await typesense.addDocuments('products', [{ id: 1, name: 'Desk' }, { id: 2, name: 'Lamp' }])

    const importRequest = fetchStub.requests.at(-1)!
    expect(importRequest.url).toBe(`${BASE}/collections/products/documents/import?action=upsert`)
    expect(importRequest.body).toBe('{"id":"1","name":"Desk"}\n{"id":"2","name":"Lamp"}')
  })
})

describe('Typesense settings', () => {
  test('settings given before the collection exists are applied when it is created', async () => {
    let created = false
    fetchStub = stubFetch((request) => {
      if (request.method === 'GET' && !created) return notFound()
      if (request.method === 'POST' && request.url === `${BASE}/collections`) {
        created = true
        return Response.json({ name: 'products' })
      }
      return new Response('{"success":true}\n{"success":true}')
    })

    await typesense.updateSettings('products', {
      searchableAttributes: ['name'],
      filterableAttributes: ['status'],
      sortableAttributes: ['created_at'],
    })
    // Nothing to type the fields from yet, so nothing is created.
    expect(fetchStub.requests.map(r => r.method)).toEqual(['GET'])

    await typesense.addDocuments('products', [
      { id: 1, name: 'Desk', status: 'published', rating: null, price: 1200, created_at: 1700000000 },
      { id: 2, name: 'Lamp', status: 'draft', rating: 4.5, price: 900, created_at: 1700000001 },
    ])

    const create = fetchStub.requests.find((r: RecordedRequest) => r.url === `${BASE}/collections`)!
    const fields = Object.fromEntries((create.json.fields as Array<Record<string, unknown>>).map(f => [f.name, f]))

    // The remembered filterable list became a facet.
    expect(fields.status).toMatchObject({ type: 'string', facet: true })
    expect(fields.created_at).toMatchObject({ type: 'int64', sort: true })
    // Typed from the second row, where the first had nothing.
    expect(fields.rating).toMatchObject({ type: 'float' })
    // Not declared sortable: left to Typesense's default (sortable, for a
    // number) rather than switched off with `sort: false`.
    expect(fields.price).toMatchObject({ type: 'int64' })
    expect('sort' in fields.price!).toBe(false)
  })

  test('settings for an existing collection are patched into its schema', async () => {
    fetchStub = stubFetch((request) => {
      if (request.method === 'GET') {
        return Response.json({
          name: 'products',
          fields: [
            { name: 'id', type: 'string' },
            { name: 'status', type: 'string', facet: false, sort: false, optional: true, index: true, infix: false, locale: '' },
            { name: 'name', type: 'string', facet: false, sort: false, optional: true },
          ],
        })
      }
      return Response.json({})
    })

    await typesense.updateSettings('products', { filterableAttributes: ['status'] })

    const patch = fetchStub.requests.at(-1)!
    expect(patch.method).toBe('PATCH')
    expect(patch.url).toBe(`${BASE}/collections/products`)
    expect(patch.json).toEqual({
      fields: [
        { name: 'status', drop: true },
        { name: 'status', type: 'string', facet: true, sort: false, optional: true },
      ],
    })
  })

  test('a failure reading the collection is not mistaken for its absence', async () => {
    fetchStub = stubFetch(() => new Response('{"message":"Forbidden"}', { status: 401 }))

    await expect(typesense.addDocument('products', { id: 1, name: 'Desk' })).rejects.toThrow(/401/)
    expect(fetchStub.requests.map(r => r.method)).toEqual(['GET'])
  })
})
