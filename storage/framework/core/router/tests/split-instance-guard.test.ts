import { afterEach, describe, expect, test } from 'bun:test'
import { route, warnOnMultipleRouterInstances } from '../src/stacks-router'

// stacksjs/stacks#1975 / #1982 — a dist-only app that also vendors
// storage/framework/core can load two physically distinct @stacksjs/router
// modules (tsconfig `paths` splits core files -> ./router/src and root files
// -> node_modules dist). Historically user routes registered on one `route`
// singleton, the server served the other, and every route 404'd silently.
//
// The fix makes the split harmless: the `route` singleton (and the
// request-context ALS) are keyed on process-global Symbols, so every copy
// shares one route table. serve() then only WARNS on a duplicate rather than
// throwing. These pin both properties.

const INSTANCES_KEY = Symbol.for('@stacksjs/router:loaded-instances')
const ROUTE_KEY = Symbol.for('@stacksjs/router:route-singleton')
const instances = (globalThis as Record<symbol, unknown>)[INSTANCES_KEY] as Set<string>
const FAKE = '/fake/node_modules/@stacksjs/router/dist/index.js'

afterEach(() => {
  instances.delete(FAKE)
})

describe('router split-instance handling (#1975/#1982)', () => {
  test('the route singleton is shared via a process-global Symbol', () => {
    // Any second @stacksjs/router copy that evaluates `route` resolves this
    // same object, so both copies register into one table.
    expect((globalThis as Record<symbol, unknown>)[ROUTE_KEY]).toBe(route)
  })

  test('warnOnMultipleRouterInstances returns false (and never throws) for a single instance', () => {
    expect(instances.size).toBeGreaterThanOrEqual(1)
    let detected: boolean | undefined
    expect(() => { detected = warnOnMultipleRouterInstances() }).not.toThrow()
    expect(detected).toBe(false)
  })

  test('detects a second distinct instance but still does NOT throw (routing works via the shared table)', () => {
    instances.add(FAKE)
    let detected: boolean | undefined
    expect(() => { detected = warnOnMultipleRouterInstances() }).not.toThrow()
    expect(detected).toBe(true)
  })
})
