import { afterEach, describe, expect, test } from 'bun:test'
import {
  clearEnvelopeWarnings,
  createEnvelope,
  JOB_ENVELOPE_VERSION,
  parseEnvelope,
} from '../src/envelope'

// stacksjs/stacks#1884 Q-6 — unified job envelope across database +
// redis drivers. The parser also has to handle in-flight jobs queued
// under the pre-#1884 implicit-v0 shape AND Laravel-import legacy.

describe('createEnvelope', () => {
  test('produces a v1 envelope with all required fields', () => {
    const env = createEnvelope('SendInvoice', { orderId: 42 })
    expect(env.jobName).toBe('SendInvoice')
    expect(env.payload).toEqual({ orderId: 42 })
    expect(env.envelopeVersion).toBe(JOB_ENVELOPE_VERSION)
    expect(env.envelopeVersion).toBe(1)
    expect(typeof env.dispatchedAt).toBe('string')
    expect(env.dispatchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/)
  })

  test('passes options through verbatim', () => {
    const env = createEnvelope('ProcessOrder', null, {
      queue: 'orders',
      timeout: 30,
      tries: 3,
      backoff: [10, 30, 60],
    })
    expect(env.options).toEqual({
      queue: 'orders',
      timeout: 30,
      tries: 3,
      backoff: [10, 30, 60],
    })
  })

  test('options omitted entirely when not provided', () => {
    const env = createEnvelope('Foo', { a: 1 })
    expect(env.options).toBeUndefined()
  })
})

describe('parseEnvelope', () => {
  afterEach(() => {
    clearEnvelopeWarnings()
  })

  test('parses a v1 envelope (object input) — round-trip', () => {
    const original = createEnvelope('SendEmail', { to: 'a@b.com' }, { tries: 3 })
    const parsed = parseEnvelope(original)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.source).toBe('v1')
    expect(parsed.envelope.jobName).toBe('SendEmail')
    expect(parsed.envelope.payload).toEqual({ to: 'a@b.com' })
    expect(parsed.envelope.options?.tries).toBe(3)
  })

  test('parses a v1 envelope (JSON string input)', () => {
    const original = createEnvelope('Foo', { x: 1 })
    const serialized = JSON.stringify(original)
    const parsed = parseEnvelope(serialized)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.source).toBe('v1')
    expect(parsed.envelope.jobName).toBe('Foo')
  })

  test('parses v0 implicit shape (pre-#1884: no envelopeVersion field)', () => {
    const v0Shape = {
      jobName: 'OldJob',
      payload: { hello: 'world' },
      options: { tries: 5 },
    }
    const parsed = parseEnvelope(v0Shape)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.source).toBe('v0-implicit')
    expect(parsed.envelope.jobName).toBe('OldJob')
    expect(parsed.envelope.payload).toEqual({ hello: 'world' })
    expect(parsed.envelope.options?.tries).toBe(5)
    expect(parsed.envelope.envelopeVersion).toBe(JOB_ENVELOPE_VERSION)
  })

  test('parses Laravel-legacy shape (`App\\\\Jobs\\\\Foo`)', () => {
    const legacy = {
      job: 'App\\Jobs\\SendNotification',
      data: { userId: 7 },
    }
    const parsed = parseEnvelope(legacy)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.source).toBe('laravel-legacy')
    expect(parsed.envelope.jobName).toBe('SendNotification')
    expect(parsed.envelope.payload).toEqual({ userId: 7 })
  })

  test('rejects a non-object payload', () => {
    const parsed = parseEnvelope(42)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.reason).toBe('malformed')
  })

  test('rejects invalid JSON string', () => {
    const parsed = parseEnvelope('not-json')
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.reason).toBe('malformed')
  })

  test('rejects an object with no jobName / job field', () => {
    const parsed = parseEnvelope({ payload: { foo: 1 } })
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.reason).toBe('missing-job-name')
  })

  test('rejects a v1-shaped envelope with non-string jobName', () => {
    const malformed = {
      jobName: 123,
      payload: {},
      envelopeVersion: 1,
      dispatchedAt: new Date().toISOString(),
    }
    const parsed = parseEnvelope(malformed)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.reason).toBe('missing-job-name')
  })

  test('skips a newer envelopeVersion (forward-compat)', () => {
    const fromTheFuture = {
      jobName: 'Foo',
      payload: {},
      envelopeVersion: JOB_ENVELOPE_VERSION + 1,
      dispatchedAt: new Date().toISOString(),
    }
    const parsed = parseEnvelope(fromTheFuture)
    expect(parsed.ok).toBe(false)
    if (parsed.ok) return
    expect(parsed.reason).toBe('unknown-version')
    expect(parsed.detail).toContain(`envelopeVersion=${JOB_ENVELOPE_VERSION + 1}`)
  })

  test('payload value is preserved verbatim (null is legal)', () => {
    const env = createEnvelope('Foo', null)
    const parsed = parseEnvelope(env)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.envelope.payload).toBeNull()
  })

  test('payload value is preserved verbatim (undefined survives via implicit JSON conversion)', () => {
    // JSON.stringify drops `undefined`, but the in-process object
    // path preserves it. Test both the object path and the
    // JSON-serialized path so callers know what to expect.
    const objPath = parseEnvelope(createEnvelope('Foo', undefined))
    expect(objPath.ok).toBe(true)
    if (!objPath.ok) return
    expect(objPath.envelope.payload).toBeUndefined()

    // JSON path: undefined → field omitted → parsed back as undefined.
    const jsonPath = parseEnvelope(JSON.stringify(createEnvelope('Foo', undefined)))
    expect(jsonPath.ok).toBe(true)
    if (!jsonPath.ok) return
    expect(jsonPath.envelope.payload).toBeUndefined()
  })

  test('round-trip preserves dispatchedAt', () => {
    const env = createEnvelope('Foo', { x: 1 })
    const parsed = parseEnvelope(JSON.stringify(env))
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.envelope.dispatchedAt).toBe(env.dispatchedAt)
  })

  test('v0-implicit parse fills in a sentinel dispatchedAt when missing', () => {
    const v0 = { jobName: 'OldJob', payload: {} }
    const parsed = parseEnvelope(v0)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    // Sentinel = epoch — distinguishable from any real dispatch.
    expect(parsed.envelope.dispatchedAt).toBe(new Date(0).toISOString())
  })
})
