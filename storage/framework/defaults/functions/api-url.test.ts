/**
 * `resolveApiBaseUrl` must survive a `window` that is not a DOM.
 *
 * It guarded on `typeof window !== 'undefined'` and then read
 * `window.location.origin`. Test harnesses assign `globalThis.window =
 * globalThis` so browser code can be imported off-DOM, and that object has no
 * `location` - so the guard passed and the next property read threw.
 *
 * Callers resolve this at MODULE scope (`monitoring/errors.ts` builds its
 * `baseURL` there), so the throw happened on import: an unhandled error
 * between tests, attributed to no test, which is why it survived a full-suite
 * cleanup that fixed everything with a name (stacksjs/stacks#2421).
 */
import { afterEach, describe, expect, it } from 'bun:test'
import { resolveApiBaseUrl } from './api-url'

const REAL = {
  window: (globalThis as any).window,
  configured: (globalThis as any).__STACKS_API_URL__,
}

afterEach(() => {
  for (const [key, value] of Object.entries({ window: REAL.window, __STACKS_API_URL__: REAL.configured })) {
    if (value === undefined)
      delete (globalThis as any)[key]
    else
      (globalThis as any)[key] = value
  }
})

describe('resolveApiBaseUrl', () => {
  it('falls back to the relative path when window has no location', () => {
    // Exactly what a harness leaves behind: a window that is not a DOM.
    ;(globalThis as any).window = globalThis
    delete (globalThis as any).__STACKS_API_URL__

    expect(resolveApiBaseUrl()).toBe('/api')
  })

  it('uses the origin when there is a real one', () => {
    ;(globalThis as any).window = { location: { origin: 'https://app.test' } }
    delete (globalThis as any).__STACKS_API_URL__

    expect(resolveApiBaseUrl()).toBe('https://app.test/api')
    expect(resolveApiBaseUrl('/v1')).toBe('https://app.test/v1')
  })

  it('prefers an injected URL over the origin, without its trailing slashes', () => {
    ;(globalThis as any).window = { location: { origin: 'https://app.test' } }
    ;(globalThis as any).__STACKS_API_URL__ = 'https://api.test//'

    expect(resolveApiBaseUrl()).toBe('https://api.test')
  })

  it('falls back to the relative path off-DOM entirely', () => {
    delete (globalThis as any).window
    delete (globalThis as any).__STACKS_API_URL__

    expect(resolveApiBaseUrl()).toBe('/api')
  })
})
