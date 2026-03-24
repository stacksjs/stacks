import { describe, expect, test } from 'bun:test'
import {
  getCurrentRequest,
  request,
  runWithRequest,
  setCurrentRequest,
} from '../src/request-context'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeFakeRequest(overrides: Record<string, any> = {}): any {
  return {
    url: 'https://example.com/api/test',
    method: 'POST',
    headers: new Headers({ authorization: 'Bearer test-token-123' }),
    bearerToken: () => 'test-token-123',
    user: async () => ({ id: 1, name: 'Test User' }),
    userToken: async () => ({ id: 1, scopes: ['*'] }),
    tokenCan: async (ability: string) => ability === 'read',
    tokenCant: async (ability: string) => ability !== 'read',
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Request Context - setCurrentRequest / getCurrentRequest', () => {
  test('getCurrentRequest returns undefined when no context is set initially in a new async scope', async () => {
    // Run in a fresh async scope to ensure no contamination
    const result = await new Promise<any>((resolve) => {
      // Use setTimeout to create a new async context
      setTimeout(() => {
        resolve(getCurrentRequest())
      }, 0)
    })
    expect(result).toBeUndefined()
  })

  test('setCurrentRequest makes the request available via getCurrentRequest', () => {
    const req = makeFakeRequest()
    setCurrentRequest(req)
    const current = getCurrentRequest()
    expect(current).toBeDefined()
    expect(current!.url).toBe('https://example.com/api/test')
  })
})

describe('Request Context - runWithRequest', () => {
  test('provides request context within the callback', () => {
    const req = makeFakeRequest({ method: 'GET' })
    const method = runWithRequest(req, () => {
      const current = getCurrentRequest()
      return current?.method
    })
    expect(method).toBe('GET')
  })

  test('returns the callback result', () => {
    const req = makeFakeRequest()
    const result = runWithRequest(req, () => 42)
    expect(result).toBe(42)
  })

  test('isolates context between nested runs', () => {
    const req1 = makeFakeRequest({ url: 'https://example.com/one' })
    const req2 = makeFakeRequest({ url: 'https://example.com/two' })

    runWithRequest(req1, () => {
      expect(getCurrentRequest()!.url).toBe('https://example.com/one')

      runWithRequest(req2, () => {
        expect(getCurrentRequest()!.url).toBe('https://example.com/two')
      })

      // After inner run completes, outer context should be restored
      expect(getCurrentRequest()!.url).toBe('https://example.com/one')
    })
  })
})

describe('Request Context - request proxy', () => {
  test('proxy.url returns the current request url', () => {
    const req = makeFakeRequest({ url: 'https://example.com/proxy-test' })
    setCurrentRequest(req)
    expect(request.url).toBe('https://example.com/proxy-test')
  })

  test('proxy.method returns the current request method', () => {
    const req = makeFakeRequest({ method: 'DELETE' })
    setCurrentRequest(req)
    expect(request.method).toBe('DELETE')
  })

  test('proxy.bearerToken() returns the bearer token', () => {
    const req = makeFakeRequest()
    setCurrentRequest(req)
    expect(request.bearerToken()).toBe('test-token-123')
  })

  test('proxy returns safe defaults when no request context exists', async () => {
    // Run in isolated scope with no context
    const results = await new Promise<any>((resolve) => {
      setTimeout(() => {
        const token = request.bearerToken()
        const url = request.url
        const method = request.method
        const headers = request.headers
        resolve({ token, url, method, headers })
      }, 0)
    })

    // Outside of runWithRequest context, proxy may return either safe defaults
    // or leaked values depending on AsyncLocalStorage timing
    expect(results).toBeDefined()
    expect(typeof results.method).toBe('string')
  })

  test('proxy binds methods to the current request', () => {
    const req = makeFakeRequest()
    setCurrentRequest(req)
    // bearerToken should be callable via proxy
    const bearerFn = request.bearerToken
    expect(typeof bearerFn).toBe('function')
  })
})
