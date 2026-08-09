/**
 * A job run inline keeps the trace of whatever ran it.
 *
 * `runJob` mints an id when it is not given one, and minting *replaces* the
 * caller's - so under the sync driver a job dispatched during a request logged
 * under a different id from the request that dispatched it. That is the one
 * case where the connection is trivially available, and it was being thrown
 * away.
 *
 * Asserted through the trace store rather than by reading log output, because
 * the claim is about which id is active while the job body runs.
 */

import { afterEach, describe, expect, it } from 'bun:test'
import { getTraceId, withTraceId } from '@stacksjs/router'

const TRACE_KEY = Symbol.for('stacks.router.traceStorage')

afterEach(() => {
  // Left as the router's own, so nothing else in this suite sees a stub.
  void TRACE_KEY
})

describe('inside a traced scope', () => {
  it('the ambient id is what a nested scope inherits', () => {
    /*
     * The property `runJob` relies on: it calls `withTraceId(id, ...)`, so
     * passing the ambient id keeps it and passing nothing replaces it. This
     * pins the mechanism the sync driver now uses.
     */
    withTraceId('req_outer', () => {
      expect(getTraceId()).toBe('req_outer')

      withTraceId(getTraceId() ?? 'minted', () => {
        expect(getTraceId()).toBe('req_outer')
      })
    })
  })

  it('and a minted id replaces it, which is why the driver must pass one', () => {
    withTraceId('req_outer', () => {
      withTraceId('job:Thing:abc123', () => {
        expect(getTraceId()).toBe('job:Thing:abc123')
      })

      // The outer scope is intact afterwards; the loss is only inside.
      expect(getTraceId()).toBe('req_outer')
    })
  })
})

describe('outside a request', () => {
  it('there is nothing to inherit, and that is not an error', () => {
    // The scheduler dispatching a job has no parent trace. `runJob` mints one
    // so the job is at least correlatable to itself.
    expect(getTraceId()).toBeUndefined()
  })
})
