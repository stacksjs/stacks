import { describe, expect, it } from 'bun:test'

// Import the real modules directly
const { useFetch } = await import('../src/useFetch')
const { createFetch } = await import('../src/createFetch')

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
    const result = useFetch('/api/test').get().json()
    expect(result).toBeDefined()
    expect(result.data).toBeDefined()
  })

  it('supports full chain: .post().json()', () => {
    const result = useFetch('/api/test').post('{}').json()
    expect(result).toBeDefined()
    expect(result.data).toBeDefined()
  })

  it('supports full chain: .delete().json()', () => {
    const result = useFetch('/api/test').delete().json()
    expect(result).toBeDefined()
    expect(result.data).toBeDefined()
  })

  it('supports method override by chaining multiple method calls', () => {
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
    const result = useFetch('/api/test').get().json()
    expect(result).toHaveProperty('data')
    expect(result).toHaveProperty('error')
    expect(result).toHaveProperty('isFetching')
    expect(result).toHaveProperty('then')
  })

  it('data is a ref (has .value property)', () => {
    const result = useFetch('/api/test').get().json()
    expect('value' in result.data).toBe(true)
  })

  it('error is a ref (has .value property)', () => {
    const result = useFetch('/api/test').get().json()
    expect('value' in result.error).toBe(true)
  })

  it('isFetching is a ref (has .value property)', () => {
    const result = useFetch('/api/test').get().json()
    expect('value' in result.isFetching).toBe(true)
  })

  it('then is a function', () => {
    const result = useFetch('/api/test').get().json()
    expect(typeof result.then).toBe('function')
  })

  it('isFetching starts as true', () => {
    const result = useFetch('/api/test').get().json()
    // isFetching is true synchronously (before the microtask resolves)
    expect(result.isFetching.value).toBe(true)
  })
})

// ---------------------------------------------------------------------------
//  createFetch with baseUrl
// ---------------------------------------------------------------------------
describe('createFetch with baseUrl', () => {
  it('returns a builder that supports all methods', () => {
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
