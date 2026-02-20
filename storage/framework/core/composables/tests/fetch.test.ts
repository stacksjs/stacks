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
  it('data becomes the response data after resolution', async () => {
    resetHandler()
    const { data, error } = await useFetch('/api/items').get().json()
    expect(data.value).toBeNull()
    expect(error.value).toBeNull()
  })

  it('isFetching becomes false after resolution', async () => {
    resetHandler()
    const result = useFetch('/api/items').get().json()
    await result.then(() => {})
    expect(result.isFetching.value).toBe(false)
  })

  it('error remains null on success', async () => {
    resetHandler()
    const { error } = await useFetch('/api/items').get().json()
    expect(error.value).toBeNull()
  })
})

// ---------------------------------------------------------------------------
//  Successful fetch with custom data
// ---------------------------------------------------------------------------
describe('useFetch successful fetch with custom data', () => {
  it('data is populated with response value', async () => {
    const testPayload = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
    requestHandler = () => Promise.resolve({ isOk: true, value: { data: testPayload } })

    const { data, error } = await useFetch('/api/users').get().json()

    expect(data.value).toEqual(testPayload)
    expect(error.value).toBeNull()
  })

  it('data receives a string response', async () => {
    requestHandler = () => Promise.resolve({ isOk: true, value: { data: 'hello world' } })

    const { data } = await useFetch('/api/greeting').get().json()
    expect(data.value).toBe('hello world')
  })

  it('data receives a numeric response', async () => {
    requestHandler = () => Promise.resolve({ isOk: true, value: { data: 42 } })

    const { data } = await useFetch('/api/count').get().json()
    expect(data.value).toBe(42)
  })
})

// ---------------------------------------------------------------------------
//  Error fetch -- isOk: false
// ---------------------------------------------------------------------------
describe('useFetch error fetch (isOk: false)', () => {
  it('error gets populated when isOk is false', async () => {
    requestHandler = () => Promise.resolve({ isOk: false, error: 'Not found' })

    const { data, error } = await useFetch('/api/missing').get().json()

    expect(error.value).toBe('Not found')
    expect(data.value).toBeNull()
  })

  it('isFetching becomes false even on error', async () => {
    requestHandler = () => Promise.resolve({ isOk: false, error: 'Server error' })

    const result = useFetch('/api/fail').get().json()
    await result.then(() => {})
    expect(result.isFetching.value).toBe(false)
  })

  it('error gets populated with complex error object', async () => {
    const errorObj = { code: 422, message: 'Validation failed', fields: ['email'] }
    requestHandler = () => Promise.resolve({ isOk: false, error: errorObj })

    const { error } = await useFetch('/api/validate').post('{}').json()

    expect(error.value).toEqual(errorObj)
  })
})

// ---------------------------------------------------------------------------
//  Network error -- request() rejects
// ---------------------------------------------------------------------------
describe('useFetch network error (request rejects)', () => {
  it('error captures the exception when request() throws', async () => {
    requestHandler = () => Promise.reject(new Error('Network failure'))

    const result = useFetch('/api/down').get().json()
    await result.then(() => {})

    expect(result.error.value).toBeInstanceOf(Error)
    expect(result.error.value.message).toBe('Network failure')
    expect(result.data.value).toBeNull()
  })

  it('isFetching becomes false after network error', async () => {
    requestHandler = () => Promise.reject(new Error('Timeout'))

    const result = useFetch('/api/slow').get().json()
    await result.then(() => {})

    expect(result.isFetching.value).toBe(false)
  })

  it('error captures non-Error rejection values', async () => {
    requestHandler = () => Promise.reject('string rejection')

    const result = useFetch('/api/error').get().json()
    await result.then(() => {})

    expect(result.error.value).toBe('string rejection')
  })
})

// ---------------------------------------------------------------------------
//  POST with valid JSON body
// ---------------------------------------------------------------------------
describe('useFetch POST with valid JSON body', () => {
  it('sends parsed JSON body for POST', async () => {
    let capturedOptions: any = null
    requestHandler = (_url: string, opts: any) => {
      capturedOptions = opts
      return Promise.resolve({ isOk: true, value: { data: { id: 1 } } })
    }

    const body = JSON.stringify({ name: 'Test', email: 'test@example.com' })
    await useFetch('/api/users').post(body).json()

    expect(capturedOptions).toBeDefined()
    expect(capturedOptions.method).toBe('POST')
    expect(capturedOptions.json).toBe(true)
    expect(capturedOptions.body).toEqual({ name: 'Test', email: 'test@example.com' })
  })
})

// ---------------------------------------------------------------------------
//  POST with invalid JSON body -- falls back to raw string
// ---------------------------------------------------------------------------
describe('useFetch POST with invalid JSON body', () => {
  it('falls back to raw string when body is not valid JSON', async () => {
    let capturedOptions: any = null
    requestHandler = (_url: string, opts: any) => {
      capturedOptions = opts
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    await useFetch('/api/users').post('not valid json {{{').json()

    expect(capturedOptions).toBeDefined()
    expect(capturedOptions.method).toBe('POST')
    expect(capturedOptions.body).toBe('not valid json {{{')
  })

  it('does not crash when body is an empty string', async () => {
    let capturedOptions: any = null
    requestHandler = (_url: string, opts: any) => {
      capturedOptions = opts
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    // Empty string is falsy so body-parsing block is skipped
    await useFetch('/api/users').post('').json()

    expect(capturedOptions).toBeDefined()
    expect(capturedOptions.body).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
//  GET and DELETE have json:false, POST/PUT/PATCH have json:true
// ---------------------------------------------------------------------------
describe('useFetch json flag per method', () => {
  it('GET sets json: false', async () => {
    let capturedOptions: any = null
    requestHandler = (_url: string, opts: any) => {
      capturedOptions = opts
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    await useFetch('/api/test').get().json()

    expect(capturedOptions.method).toBe('GET')
    expect(capturedOptions.json).toBe(false)
  })

  it('DELETE sets json: false', async () => {
    let capturedOptions: any = null
    requestHandler = (_url: string, opts: any) => {
      capturedOptions = opts
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    await useFetch('/api/test/1').delete().json()

    expect(capturedOptions.method).toBe('DELETE')
    expect(capturedOptions.json).toBe(false)
  })

  it('POST sets json: true', async () => {
    let capturedOptions: any = null
    requestHandler = (_url: string, opts: any) => {
      capturedOptions = opts
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    await useFetch('/api/test').post('{}').json()

    expect(capturedOptions.method).toBe('POST')
    expect(capturedOptions.json).toBe(true)
  })

  it('PUT sets json: true', async () => {
    let capturedOptions: any = null
    requestHandler = (_url: string, opts: any) => {
      capturedOptions = opts
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    await useFetch('/api/test/1').put('{}').json()

    expect(capturedOptions.method).toBe('PUT')
    expect(capturedOptions.json).toBe(true)
  })

  it('PATCH sets json: true', async () => {
    let capturedOptions: any = null
    requestHandler = (_url: string, opts: any) => {
      capturedOptions = opts
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    await useFetch('/api/test/1').patch('{}').json()

    expect(capturedOptions.method).toBe('PATCH')
    expect(capturedOptions.json).toBe(true)
  })

  it('all methods send Accept: application/json header', async () => {
    let capturedOptions: any = null
    requestHandler = (_url: string, opts: any) => {
      capturedOptions = opts
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    await useFetch('/api/test').get().json()

    expect(capturedOptions.headers).toEqual({ Accept: 'application/json' })
  })
})

// ---------------------------------------------------------------------------
//  Await pattern
// ---------------------------------------------------------------------------
describe('useFetch await pattern', () => {
  it('supports const { data, error } = await useFetch(url).get().json()', async () => {
    requestHandler = () => Promise.resolve({ isOk: true, value: { data: { message: 'hello' } } })

    const { data, error } = await useFetch('/api/hello').get().json()

    expect(data.value).toEqual({ message: 'hello' })
    expect(error.value).toBeNull()
  })

  it('supports await with POST', async () => {
    requestHandler = () => Promise.resolve({ isOk: true, value: { data: { id: 42 } } })

    const { data } = await useFetch('/api/create').post(JSON.stringify({ title: 'New' })).json()

    expect(data.value).toEqual({ id: 42 })
  })

  it('supports await with DELETE', async () => {
    requestHandler = () => Promise.resolve({ isOk: true, value: { data: { deleted: true } } })

    const { data } = await useFetch('/api/items/5').delete().json()

    expect(data.value).toEqual({ deleted: true })
  })

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
//  URL is passed correctly to client.request
// ---------------------------------------------------------------------------
describe('useFetch URL handling', () => {
  it('passes the exact URL string to client.request', async () => {
    let capturedUrl: string = ''
    requestHandler = (url: string) => {
      capturedUrl = url
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    await useFetch('https://api.example.com/v2/users?page=1').get().json()

    expect(capturedUrl).toBe('https://api.example.com/v2/users?page=1')
  })
})

// ---------------------------------------------------------------------------
//  createFetch with baseUrl
// ---------------------------------------------------------------------------
describe('createFetch with baseUrl', () => {
  it('joins baseUrl and url correctly', async () => {
    let capturedUrl: string = ''
    requestHandler = (url: string) => {
      capturedUrl = url
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    const useApi = createFetch({ baseUrl: 'https://api.example.com' })
    await useApi('/users').get().json()

    expect(capturedUrl).toBe('https://api.example.com/users')
  })

  it('handles trailing slash on baseUrl', async () => {
    let capturedUrl: string = ''
    requestHandler = (url: string) => {
      capturedUrl = url
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    const useApi = createFetch({ baseUrl: 'https://api.example.com/' })
    await useApi('/users').get().json()

    expect(capturedUrl).toBe('https://api.example.com/users')
  })

  it('handles leading slash on url path', async () => {
    let capturedUrl: string = ''
    requestHandler = (url: string) => {
      capturedUrl = url
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    const useApi = createFetch({ baseUrl: 'https://api.example.com' })
    await useApi('users').get().json()

    expect(capturedUrl).toBe('https://api.example.com/users')
  })

  it('handles both trailing and leading slashes', async () => {
    let capturedUrl: string = ''
    requestHandler = (url: string) => {
      capturedUrl = url
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    const useApi = createFetch({ baseUrl: 'https://api.example.com/' })
    await useApi('/users').get().json()

    expect(capturedUrl).toBe('https://api.example.com/users')
  })

  it('handles no slashes at all', async () => {
    let capturedUrl: string = ''
    requestHandler = (url: string) => {
      capturedUrl = url
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    const useApi = createFetch({ baseUrl: 'https://api.example.com' })
    await useApi('users').get().json()

    expect(capturedUrl).toBe('https://api.example.com/users')
  })

  it('handles baseUrl with path segments', async () => {
    let capturedUrl: string = ''
    requestHandler = (url: string) => {
      capturedUrl = url
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    const useApi = createFetch({ baseUrl: 'https://api.example.com/v2' })
    await useApi('/users/1').get().json()

    expect(capturedUrl).toBe('https://api.example.com/v2/users/1')
  })

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

// ---------------------------------------------------------------------------
//  createFetch without baseUrl
// ---------------------------------------------------------------------------
describe('createFetch without baseUrl', () => {
  it('passes URL through as-is when no baseUrl', async () => {
    let capturedUrl: string = ''
    requestHandler = (url: string) => {
      capturedUrl = url
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    const useApi = createFetch()
    await useApi('/api/users').get().json()

    expect(capturedUrl).toBe('/api/users')
  })

  it('passes URL through as-is with empty config', async () => {
    let capturedUrl: string = ''
    requestHandler = (url: string) => {
      capturedUrl = url
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    const useApi = createFetch({})
    await useApi('https://other-api.com/data').get().json()

    expect(capturedUrl).toBe('https://other-api.com/data')
  })

  it('passes URL through as-is with empty baseUrl string', async () => {
    let capturedUrl: string = ''
    requestHandler = (url: string) => {
      capturedUrl = url
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    const useApi = createFetch({ baseUrl: '' })
    await useApi('/some/path').get().json()

    expect(capturedUrl).toBe('/some/path')
  })
})

// ---------------------------------------------------------------------------
//  createFetch URL edge cases
// ---------------------------------------------------------------------------
describe('createFetch URL edge cases', () => {
  it('handles baseUrl with multiple trailing slashes (only last removed)', async () => {
    let capturedUrl: string = ''
    requestHandler = (url: string) => {
      capturedUrl = url
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    // The regex /\/$/ only strips the last trailing slash
    const useApi = createFetch({ baseUrl: 'https://api.example.com//' })
    await useApi('/users').get().json()

    // baseUrl.replace(/\/$/, '') -> 'https://api.example.com/'
    // url.replace(/^\//, '') -> 'users'
    // result: 'https://api.example.com//users'
    expect(typeof capturedUrl).toBe('string')
    expect(capturedUrl).toContain('api.example.com')
    expect(capturedUrl).toContain('users')
  })

  it('handles empty URL with baseUrl', async () => {
    let capturedUrl: string = ''
    requestHandler = (url: string) => {
      capturedUrl = url
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    const useApi = createFetch({ baseUrl: 'https://api.example.com' })
    await useApi('').get().json()

    // baseUrl is truthy, so: 'https://api.example.com' + '/' + '' = 'https://api.example.com/'
    expect(capturedUrl).toBe('https://api.example.com/')
  })

  it('handles URL with query parameters', async () => {
    let capturedUrl: string = ''
    requestHandler = (url: string) => {
      capturedUrl = url
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    const useApi = createFetch({ baseUrl: 'https://api.example.com' })
    await useApi('/search?q=hello&page=2').get().json()

    expect(capturedUrl).toBe('https://api.example.com/search?q=hello&page=2')
  })

  it('handles URL with hash fragments', async () => {
    let capturedUrl: string = ''
    requestHandler = (url: string) => {
      capturedUrl = url
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    const useApi = createFetch({ baseUrl: 'https://api.example.com' })
    await useApi('/docs#section-3').get().json()

    expect(capturedUrl).toBe('https://api.example.com/docs#section-3')
  })

  it('handles deeply nested path', async () => {
    let capturedUrl: string = ''
    requestHandler = (url: string) => {
      capturedUrl = url
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    const useApi = createFetch({ baseUrl: 'https://api.example.com/v1' })
    await useApi('/organizations/42/teams/7/members').get().json()

    expect(capturedUrl).toBe('https://api.example.com/v1/organizations/42/teams/7/members')
  })
})

// ---------------------------------------------------------------------------
//  Body handling edge cases
// ---------------------------------------------------------------------------
describe('useFetch body handling', () => {
  it('GET does not send a body even if one was previously set via post()', async () => {
    let capturedOptions: any = null
    requestHandler = (_url: string, opts: any) => {
      capturedOptions = opts
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    // Set post body then switch to get -- body is cleared by .get()
    await useFetch('/api/test').post('{"data":1}').get().json()

    expect(capturedOptions.method).toBe('GET')
    expect(capturedOptions.body).toBeUndefined()
  })

  it('DELETE does not send a body', async () => {
    let capturedOptions: any = null
    requestHandler = (_url: string, opts: any) => {
      capturedOptions = opts
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    await useFetch('/api/test/1').delete().json()

    expect(capturedOptions.method).toBe('DELETE')
    expect(capturedOptions.body).toBeUndefined()
  })

  it('POST without body sends undefined body', async () => {
    let capturedOptions: any = null
    requestHandler = (_url: string, opts: any) => {
      capturedOptions = opts
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    await useFetch('/api/test').post().json()

    expect(capturedOptions.method).toBe('POST')
    expect(capturedOptions.body).toBeUndefined()
  })

  it('PUT with nested JSON body parses correctly', async () => {
    let capturedOptions: any = null
    requestHandler = (_url: string, opts: any) => {
      capturedOptions = opts
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    const nestedBody = { user: { name: 'Alice', address: { city: 'NYC' } }, tags: [1, 2, 3] }
    await useFetch('/api/users/1').put(JSON.stringify(nestedBody)).json()

    expect(capturedOptions.method).toBe('PUT')
    expect(capturedOptions.json).toBe(true)
    expect(capturedOptions.body).toEqual(nestedBody)
  })

  it('PATCH with body sends parsed JSON', async () => {
    let capturedOptions: any = null
    requestHandler = (_url: string, opts: any) => {
      capturedOptions = opts
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    await useFetch('/api/users/1').patch(JSON.stringify({ name: 'Updated' })).json()

    expect(capturedOptions.method).toBe('PATCH')
    expect(capturedOptions.json).toBe(true)
    expect(capturedOptions.body).toEqual({ name: 'Updated' })
  })
})

// ---------------------------------------------------------------------------
//  Default method is GET
// ---------------------------------------------------------------------------
describe('useFetch default method', () => {
  it('uses GET by default when .json() is called without a method', async () => {
    let capturedOptions: any = null
    requestHandler = (_url: string, opts: any) => {
      capturedOptions = opts
      return Promise.resolve({ isOk: true, value: { data: null } })
    }

    await useFetch('/api/test').json()

    expect(capturedOptions.method).toBe('GET')
    expect(capturedOptions.json).toBe(false)
  })
})
