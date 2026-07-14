import { afterEach, describe, expect, test } from 'bun:test'
import { assertSingleRouterInstance } from '../src/stacks-router'

// stacksjs/stacks#1975 — a dist-only app that also vendors storage/framework/core
// can load two physically distinct @stacksjs/router modules (tsconfig `paths`
// splits core files -> ./router/src and root files -> node_modules dist). User
// routes register on one `route` singleton, the server serves the other, and
// every route 404s with no error logged. serve() now asserts a single instance.

const KEY = Symbol.for('@stacksjs/router:loaded-instances')
const instances = (globalThis as Record<symbol, unknown>)[KEY] as Set<string>
const FAKE = '/fake/node_modules/@stacksjs/router/dist/index.js'

afterEach(() => {
  instances.delete(FAKE)
})

describe('assertSingleRouterInstance (#1975)', () => {
  test('registers this module as one loaded instance', () => {
    // Importing the module recorded its own path; baseline is a single instance.
    expect(instances.size).toBeGreaterThanOrEqual(1)
    expect(() => assertSingleRouterInstance()).not.toThrow()
  })

  test('throws loudly when a second distinct instance is loaded', () => {
    instances.add(FAKE)
    expect(() => assertSingleRouterInstance()).toThrow(/distinct @stacksjs\/router instances/)
  })

  test('error names the offending file and points to the issue', () => {
    instances.add(FAKE)
    try {
      assertSingleRouterInstance()
      throw new Error('expected assertSingleRouterInstance to throw')
    }
    catch (err) {
      const msg = (err as Error).message
      expect(msg).toContain(FAKE)
      expect(msg).toContain('#1975')
    }
  })
})
