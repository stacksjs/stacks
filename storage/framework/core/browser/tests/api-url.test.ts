import { afterEach, describe, expect, it } from 'bun:test'
import { resolveApiBaseUrl, resolveApiUrl } from '../src/utils/api-url'

type BrowserGlobal = typeof globalThis & {
  __STACKS_API_URL__?: string
  window?: { location?: { origin?: string } }
}

const browserGlobal = globalThis as BrowserGlobal
const originalWindow = browserGlobal.window
const originalApiUrl = browserGlobal.__STACKS_API_URL__

afterEach(() => {
  if (originalWindow === undefined)
    delete browserGlobal.window
  else
    browserGlobal.window = originalWindow

  if (originalApiUrl === undefined)
    delete browserGlobal.__STACKS_API_URL__
  else
    browserGlobal.__STACKS_API_URL__ = originalApiUrl
})

describe('browser API URLs', () => {
  it('defaults browser clients to the same-origin API prefix', () => {
    browserGlobal.window = { location: { origin: 'https://app.test' } }
    delete browserGlobal.__STACKS_API_URL__

    expect(resolveApiBaseUrl()).toBe('https://app.test/api')
  })

  it('honours an explicitly injected API root', () => {
    browserGlobal.__STACKS_API_URL__ = 'https://api.test/v1/'

    expect(resolveApiBaseUrl()).toBe('https://api.test/v1')
  })

  it('joins legacy and canonical paths without doubling the API prefix', () => {
    expect(resolveApiUrl('/auth/me', 'https://app.test/api')).toBe('https://app.test/api/auth/me')
    expect(resolveApiUrl('/api/health', 'https://app.test/api')).toBe('https://app.test/api/health')
    expect(resolveApiUrl('org/members?active=1', 'https://app.test/api/')).toBe('https://app.test/api/org/members?active=1')
  })

  it('leaves absolute request URLs alone', () => {
    expect(resolveApiUrl('https://uploads.test/object?id=1', 'https://app.test/api')).toBe('https://uploads.test/object?id=1')
  })
})
