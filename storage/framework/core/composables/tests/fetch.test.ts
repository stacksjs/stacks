import { describe, expect, it, mock } from 'bun:test'

// ---------------------------------------------------------------------------
//  Rely on the preload for @stacksjs/stx mock (functional reactive ref).
//
//  For @stacksjs/httx we override the preload's default mock with one whose
//  behaviour can be changed per-test via the shared `requestHandler` variable.
//  Because useFetch.ts instantiates `const client = new HttxClient()` at the
//  module top level, we must make the *same* class instance delegate to a
//  mutable handler so each test can customise what `request()` returns.
// ---------------------------------------------------------------------------

/** Mutable handler -- each test can reassign this before calling useFetch. */
let requestHandler: (url: string, opts: any) => Promise<any> = () =>
  Promise.resolve({ isOk: true, value: { data: null } })

mock.module('@stacksjs/httx', () => ({
  HttxClient: class {
    request(url: string, opts: any) {
      return requestHandler(url, opts)
    }
  },
}))

// Dynamic import so the mock is in place when the module-level client is created.
const { useFetch } = await import('../src/useFetch')
const { createFetch } = await import('../src/createFetch')

/** Reset to default handler before each logical test. */
function resetHandler() {
  requestHandler = () => Promise.resolve({ isOk: true, value: { data: null } })
}

// ---------------------------------------------------------------------------
//  useFetch -- builder pattern
// ---------------------------------------------------------------------------
describe('useFetch builder pattern', () => {
  it('returns a builder object from useFetch()', () => {
    const builder = useFetch('/api/test')
    expect(builder).toBeDefined()
    expect(typeof builder.get).toBe('function')
    expect(typeof builder.post).toBe('function')
    expect(typeof builder.patch).toBe('function')
    expect(typeof builder.put).toBe('function')
    expect(typeof builder.delete).toBe('function')
    expect(typeof builder.json).toBe('function')
  })

  it('.get() returns the builder (chainable)', () => {
    const builder = useFetch('/api/test')
    const result = builder.get()
    expect(result).toBe(builder)
  })

  it('.post() returns the builder (chainable)', () => {
    const builder = useFetch('/api/test')
    const result = builder.post()
    expect(result).toBe(builder)
  })

  it('.post(body) returns the builder (chainable)', () => {
    const builder = useFetch('/api/test')
    const result = builder.post(JSON.stringify({ name: 'test' }))
    expect(result).toBe(builder)
  })

  it('.patch() returns the builder (chainable)', () => {
    const builder = useFetch('/api/test')
    const result = builder.patch()
    expect(result).toBe(builder)
  })

  it('.patch(body) returns the builder (chainable)', () => {
    const builder = useFetch('/api/test')
    const result = builder.patch(JSON.stringify({ updated: true }))
    expect(result).toBe(builder)
  })

  it('.put() returns the builder (chainable)', () => {
    const builder = useFetch('/api/test')
    const result = builder.put()
    expect(result).toBe(builder)
  })

  it('.put(body) returns the builder (chainable)', () => {
    const builder = useFetch('/api/test')
    const result = builder.put(JSON.stringify({ replaced: true }))
    expect(result).toBe(builder)
  })

  it('.delete() returns the builder (chainable)', () => {
    const builder = useFetch('/api/test')
    const result = builder.delete()
    expect(result).toBe(builder)
  })

  it('supports full chain: .get().json()', () => {
    resetHandler()
    const result = useFetch('/api/test').get().json()
    expect(result).toBeDefined()
    expect(result.data).toBeDefined()
  })

  it('supports full chain: .post().json()', () => {
    resetHandler()
    const result = useFetch('/api/test').post('{}').json()
    expect(result).toBeDefined()
    expect(result.data).toBeDefined()
  })

  it('supports full chain: .delete().json()', () => {
    resetHandler()
    const result = useFetch('/api/test').delete().json()
    expect(result).toBeDefined()
    expect(result.data).toBeDefined()
  })

  it('supports method override by chaining multiple method calls', () => {
    resetHandler()
    // Chain: start with post, then switch to get
    const result = useFetch('/api/test').post('body').get().json()
    expect(result).toBeDefined()
    expect(result.data).toBeDefined()
  })
})

// ---------------------------------------------------------------------------
//  useFetch.json() -- return shape
// ---------------------------------------------------------------------------
describe('useFetch .json() return shape', () => {
  it('returns an object with data, error, isFetching, and then', () => {
    resetHandler()
    const result = useFetch('/api/test').get().json()
    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('error')
    expect(result).toHaveProperty('isFetching')
    expect(result).toHaveProperty('then')
  })

  it('data is a ref (has .value property)', () => {
    resetHandler()
    const result = useFetch('/api/test').get().json()
    expect('value' in result.data).toBe(true)
  })

  it('error is a ref (has .value property)', () => {
    resetHandler()
    const result = useFetch('/api/test').get().json()
    expect('value' in result.error).toBe(true)
  })

  it('isFetching is a ref (has .value property)', () => {
    resetHandler()
    const result = useFetch('/api/test').get().json()
    expect('value' in result.isFetching).toBe(true)
  })

  it('then is a function', () => {
    resetHandler()
    const result = useFetch('/api/test').get().json()
    expect(typeof result.then).toBe('function')
  })

  it('isFetching starts as true', () => {
    resetHandler()
    const result = useFetch('/api/test').get().json()
    // isFetching is true synchronously (before the microtask resolves)
    expect(result.isFetching.value).toBe(true)
  })
})

// ---------------------------------------------------------------------------
//  Successful fetch -- default handler returns isOk: true, data: null
// ---------------------------------------------------------------------------
describe('useFetch successful fetch (default mock)', () => {
  it('isFetching becomes false after resolution', async () => {
    resetHandler()
    const result = useFetch('/api/items').get().json()
    await result.then(() => {})
    expect(result.isFetching.value).toBe(false)
  })
})

// ---------------------------------------------------------------------------
//  Error fetch -- isOk: false
// ---------------------------------------------------------------------------
describe('useFetch error fetch (isOk: false)', () => {
  it('isFetching becomes false even on error', async () => {
    requestHandler = () => Promise.resolve({ isOk: false, error: 'Server error' })

    const result = useFetch('/api/fail').get().json()
    await result.then(() => {})
    expect(result.isFetching.value).toBe(false)
  })
})

// ---------------------------------------------------------------------------
//  Network error -- request() rejects
// ---------------------------------------------------------------------------
describe('useFetch network error (request rejects)', () => {
  it('isFetching becomes false after network error', async () => {
    requestHandler = () => Promise.reject(new Error('Timeout'))

    const result = useFetch('/api/slow').get().json()
    await result.then(() => {})

    expect(result.isFetching.value).toBe(false)
  })
})



// ---------------------------------------------------------------------------
//  Await pattern
// ---------------------------------------------------------------------------
describe('useFetch await pattern', () => {
  it('await resolves with both data and error refs', async () => {
    requestHandler = () => Promise.resolve({ isOk: true, value: { data: 'ok' } })

    const result = await useFetch('/api/check').get().json()

    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('error')
    expect('value' in result.data).toBe(true)
    expect('value' in result.error).toBe(true)
  })
})

// ---------------------------------------------------------------------------
//  createFetch with baseUrl
// ---------------------------------------------------------------------------
describe('createFetch with baseUrl', () => {
  it('returns a builder that supports all methods', () => {
    resetHandler()
    const useApi = createFetch({ baseUrl: 'https://api.example.com' })
    const builder = useApi('/test')

    expect(typeof builder.get).toBe('function')
    expect(typeof builder.post).toBe('function')
    expect(typeof builder.patch).toBe('function')
    expect(typeof builder.put).toBe('function')
    expect(typeof builder.delete).toBe('function')
    expect(typeof builder.json).toBe('function')
  })
})



