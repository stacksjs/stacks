/**
 * A request id that follows a request into its jobs.
 *
 * A worker runs in another process, so the AsyncLocalStorage a trace lives in
 * during a request cannot reach it: the id has to travel *in the row*. Without
 * that, every job mints a fresh id and the connection between "this request was
 * slow" and "because the job it queued took nine seconds" is lost at exactly
 * the moment somebody is trying to make it.
 */

import { describe, expect, it } from 'bun:test'
import { createEnvelope, parseEnvelope } from '../src/envelope'

describe('the envelope', () => {
  it('carries the dispatcher\'s trace id', () => {
    const envelope = createEnvelope('SendMail', { to: 'a@b.c' }, undefined, 'req_abc123')

    expect(envelope.traceId).toBe('req_abc123')
  })

  it('and survives a round trip through JSON, which is how it travels', () => {
    const written = JSON.stringify(createEnvelope('SendMail', {}, undefined, 'req_abc123'))
    const parsed = parseEnvelope(JSON.parse(written))

    expect(parsed.ok).toBe(true)
    expect(parsed.ok && parsed.envelope.traceId).toBe('req_abc123')
  })

  it('leaves the field out when there is no trace to carry', () => {
    /*
     * A job dispatched by the scheduler has no parent request. Writing an empty
     * string would be worse than nothing: it reads as "traced, with an id of
     * nothing" rather than "not traced".
     */
    const envelope = createEnvelope('SendMail', {})

    expect('traceId' in envelope).toBe(false)
  })

  it('does not bump the envelope version', () => {
    /*
     * Additive and optional, deliberately. An old worker reading a new envelope
     * ignores the field; a new worker reading an old one mints an id exactly as
     * it did before. Bumping would stall in-flight jobs through a rolling
     * deploy for a field nothing requires.
     */
    const older = { jobName: 'SendMail', payload: {}, envelopeVersion: 1, dispatchedAt: new Date(0).toISOString() }
    const parsed = parseEnvelope(older)

    expect(parsed.ok).toBe(true)
    expect(parsed.ok && parsed.envelope.traceId).toBeUndefined()
  })
})
