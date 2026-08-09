/**
 * The trace id, in the log context.
 *
 * A log line without a request id is a log line nobody can join to anything.
 * The id follows a request into its jobs now, and the log is the only place
 * that becomes useful.
 *
 * Read from the router's AsyncLocalStorage through the process-global symbol it
 * publishes, rather than by importing `@stacksjs/router` - which would be a
 * cycle, since the router imports this. The tests below stand in for the router
 * by writing that same symbol, which is exactly what the contract allows.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { AsyncLocalStorage } from 'node:async_hooks'
import { getLogContext, withLogContext } from '../src'

const TRACE_KEY = Symbol.for('stacks.router.traceStorage')
const REQUEST_KEY = Symbol.for('stacks.router.requestStorage')

afterEach(() => {
  delete (globalThis as Record<symbol, unknown>)[TRACE_KEY]
  delete (globalThis as Record<symbol, unknown>)[REQUEST_KEY]
})

describe('outside a request', () => {
  it('is whatever the caller set, and nothing else', () => {
    expect(getLogContext()).toBeUndefined()
  })
})

describe('inside a traced scope', () => {
  it('carries the trace id', () => {
    const storage = new AsyncLocalStorage<string>()
    ;(globalThis as Record<symbol, unknown>)[TRACE_KEY] = storage

    storage.run('req_abc', () => {
      expect(getLogContext()?.trace_id).toBe('req_abc')
    })
  })

  it('falls back to the request id when nothing set an explicit trace', () => {
    // The router sets `_requestId` per request and that is the implicit trace.
    const requests = new AsyncLocalStorage<{ _requestId?: string }>()
    ;(globalThis as Record<symbol, unknown>)[REQUEST_KEY] = requests

    requests.run({ _requestId: 'req_from_request' }, () => {
      expect(getLogContext()?.trace_id).toBe('req_from_request')
    })
  })

  it('merges with a context the caller set', () => {
    const storage = new AsyncLocalStorage<string>()
    ;(globalThis as Record<symbol, unknown>)[TRACE_KEY] = storage

    storage.run('req_abc', () => {
      withLogContext({ repository: 'acme/api' }, () => {
        const context = getLogContext()

        expect(context?.trace_id).toBe('req_abc')
        expect((context as any)?.repository).toBe('acme/api')
      })
    })
  })

  it('and an explicit trace_id wins', () => {
    /*
     * A caller who sets one deliberately - a migration script correlating to a
     * deploy, say - should not be overwritten by an ambient one.
     */
    const storage = new AsyncLocalStorage<string>()
    ;(globalThis as Record<symbol, unknown>)[TRACE_KEY] = storage

    storage.run('req_ambient', () => {
      withLogContext({ trace_id: 'deploy_42' } as any, () => {
        expect(getLogContext()?.trace_id).toBe('deploy_42')
      })
    })
  })
})

describe('when the router is not there at all', () => {
  it('says nothing rather than throwing', () => {
    /*
     * This runs inside the logger, and a logger that throws while reporting a
     * failure turns one problem into a silent one. A CLI process has no router.
     */
    ;(globalThis as Record<symbol, unknown>)[TRACE_KEY] = { getStore: () => { throw new Error('no') } }

    expect(() => getLogContext()).not.toThrow()
  })
})
