import { afterEach, describe, expect, test } from 'bun:test'
import { searchEngine } from '@stacksjs/config'
import opensearch from '../src/drivers/opensearch'

const originalFetch = globalThis.fetch
const originalOptions = searchEngine.opensearch

afterEach(() => {
  globalThis.fetch = originalFetch
  searchEngine.opensearch = originalOptions
})

function configure(): void {
  searchEngine.opensearch = {
    host: 'search.example.test',
    protocol: 'https',
    port: 9443,
    auth: 'user:pass',
  }
}

describe('OpenSearch driver', () => {
  test('implements the document and settings contract', () => {
    for (const method of [
      'search',
      'createIndex',
      'getIndex',
      'addDocument',
      'addDocuments',
      'deleteDocument',
      'deleteDocuments',
      'getSettings',
      'updateSettings',
      'resetSettings',
      'listAllIndexes',
    ]) {
      expect(typeof opensearch[method as keyof typeof opensearch]).toBe('function')
    }
  })

  test('indexes a document with the configured endpoint and authentication', async () => {
    configure()
    let requestUrl = ''
    let requestInit: RequestInit | undefined
    globalThis.fetch = (async (input, init) => {
      requestUrl = String(input)
      requestInit = init
      return new Response(JSON.stringify({ result: 'created' }), { status: 201 })
    }) as typeof fetch

    await opensearch.addDocument('products', { id: 7, name: 'Desk' })

    expect(requestUrl).toBe('https://search.example.test:9443/products/_doc/7?refresh=wait_for')
    expect(requestInit?.method).toBe('PUT')
    expect((requestInit?.headers as Record<string, string>).Authorization).toBe('Basic dXNlcjpwYXNz')
    expect(JSON.parse(String(requestInit?.body))).toEqual({ id: 7, name: 'Desk' })
  })

  test('maps OpenSearch hits to the shared response shape', async () => {
    configure()
    globalThis.fetch = (async () => new Response(JSON.stringify({
      took: 3,
      hits: {
        total: { value: 1 },
        hits: [{ _id: '7', _source: { id: 7, name: 'Desk' } }],
      },
    }))) as typeof fetch

    const result = await opensearch.search('products', { q: 'desk', limit: 10 })

    expect(result.hits).toEqual([{ id: 7, name: 'Desk' }])
    expect(result.estimatedTotalHits).toBe(1)
    expect(result.processingTimeMs).toBe(3)
  })

  test('stores model search settings in mapping metadata', async () => {
    configure()
    const requests: Array<{ url: string, init?: RequestInit }> = []
    globalThis.fetch = (async (input, init) => {
      requests.push({ url: String(input), init })
      if (init?.method === 'GET') {
        return new Response(JSON.stringify({
          products: { mappings: { _meta: { stacks: { sortableAttributes: ['price'] } } } },
        }))
      }
      return new Response(JSON.stringify({ acknowledged: true }))
    }) as typeof fetch

    await opensearch.updateSettings('products', {
      searchableAttributes: ['name', 'description'],
      filterableAttributes: ['status'],
    } as any)

    expect(requests.map(request => request.url)).toEqual([
      'https://search.example.test:9443/products/_mapping',
      'https://search.example.test:9443/products/_mapping',
    ])
    expect(JSON.parse(String(requests[1]?.init?.body))).toEqual({
      _meta: {
        stacks: {
          sortableAttributes: ['price'],
          searchableAttributes: ['name', 'description'],
          filterableAttributes: ['status'],
        },
      },
    })
  })

  test('creates a missing index before storing model settings', async () => {
    configure()
    const requests: Array<{ url: string, method?: string }> = []
    globalThis.fetch = (async (input, init) => {
      requests.push({ url: String(input), method: init?.method })
      if (requests.length === 1)
        return new Response('missing', { status: 404 })
      return new Response(JSON.stringify({ acknowledged: true }))
    }) as typeof fetch

    await opensearch.updateSearchableAttributes('products', ['name'])

    expect(requests).toEqual([
      { url: 'https://search.example.test:9443/products/_mapping', method: 'GET' },
      { url: 'https://search.example.test:9443/products', method: 'PUT' },
      { url: 'https://search.example.test:9443/products/_mapping', method: 'PUT' },
    ])
  })

  test('reads the shared params: page 3 of 10, and an object filter as match_phrase', async () => {
    configure()
    let body: any
    globalThis.fetch = (async (_input, init) => {
      body = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ took: 1, hits: { total: { value: 0 }, hits: [] } }))
    }) as typeof fetch

    await opensearch.search('products', { q: 'desk', perPage: 10, page: 3, filter: { status: 'published', brand: ['a', 'b'] } })

    expect(body.from).toBe(20)
    expect(body.size).toBe(10)
    // An object used to be JSON-stringified into a query_string, which matched nothing.
    expect(body.query.bool.filter).toEqual([
      { match_phrase: { status: 'published' } },
      { bool: { should: [{ match_phrase: { brand: 'a' } }, { match_phrase: { brand: 'b' } }], minimum_should_match: 1 } },
    ])
  })

  test('passes a string filter through as query-string syntax', async () => {
    configure()
    let body: any
    globalThis.fetch = (async (_input, init) => {
      body = JSON.parse(String(init?.body))
      return new Response(JSON.stringify({ hits: { total: 0, hits: [] } }))
    }) as typeof fetch

    await opensearch.search('products', { q: '', limit: 5, offset: 0, filter: 'status:published' })

    expect(body.query.bool.filter).toEqual([{ query_string: { query: 'status:published' } }])
  })

  test('deleteAllDocuments empties the index with a match_all delete_by_query', async () => {
    configure()
    const requests: Array<{ url: string, method?: string, body: any }> = []
    globalThis.fetch = (async (input, init) => {
      requests.push({ url: String(input), method: init?.method, body: JSON.parse(String(init?.body)) })
      return new Response(JSON.stringify({ deleted: 3 }))
    }) as typeof fetch

    await opensearch.deleteAllDocuments('products')

    expect(requests).toEqual([{
      url: 'https://search.example.test:9443/products/_delete_by_query?refresh=true',
      method: 'POST',
      body: { query: { match_all: {} } },
    }])
  })

  test('deleteAllDocuments on a missing index is not an error', async () => {
    configure()
    globalThis.fetch = (async () => new Response('missing', { status: 404 })) as typeof fetch

    await opensearch.deleteAllDocuments('products')
  })

  test('deleteDocuments with no filter refuses instead of emptying the index', async () => {
    configure()
    let called = false
    globalThis.fetch = (async () => {
      called = true
      return new Response('{}')
    }) as typeof fetch

    await expect(opensearch.deleteDocuments('products', [])).rejects.toThrow(/needs a filter/)
    expect(called).toBe(false)
  })
})
