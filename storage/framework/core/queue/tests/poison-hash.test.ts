import { config } from '@stacksjs/config'
import { acquireDbConfigLock, db, ensureDatabaseConfigLoaded, initializeDbConfig, resetDatabaseConnection } from '@stacksjs/database'
import { expect, test } from 'bun:test'
import { hashPayload, isQuarantined, listQuarantined, quarantineJob, recordFailureForPoison, unquarantineJob } from '../src/poison'

test('payload hashes retain persisted SHA-256 vectors across serialization forms', () => {
  const vectors: Array<[unknown, string]> = [
    ['', 'e3b0c44298fc1c149afbf4c8996fb924'],
    ['hello', '2cf24dba5fb0a30e26e83b2ac5b9e29e'],
    ['café🌍\ud800', '7c0c297790dd9bfc65fc88922f14b850'],
    [null, '74234e98afe7498fb5daf1f36ac2d78a'],
    [undefined, '74234e98afe7498fb5daf1f36ac2d78a'],
    [{ value: 1 }, '48208f9428d64634bd8e28ff345bf0ea'],
    [[1, null, '🌍'], 'ca3b51da6c94f78659a73b578bf7224d'],
    [{ missing: undefined, value: 1 }, '48208f9428d64634bd8e28ff345bf0ea'],
    [new Date('2026-09-08T00:00:00Z'), 'b82fa66b938f57688313ab48384ee391'],
    [42n, '73475cb40a568e8da8a045ced110137e'],
    ['a'.repeat(65536), 'bf718b6f653bebc184e1479f1935b8da'],
  ]
  for (const [payload, expected] of vectors)
    expect(hashPayload(payload)).toBe(expected)
})

test('hashing preserves serializer side effects, fallback behavior and invalid-input errors', () => {
  let serialized = 0
  let fallback = 0
  expect(hashPayload({ toJSON() { serialized++; return 42 } })).toBe('73475cb40a568e8da8a045ced110137e')
  expect(serialized).toBe(1)
  expect(hashPayload({
    toJSON() { serialized++; throw new Error('serialize failed') },
    [Symbol.toPrimitive]() { fallback++; return 'fallback' },
  })).toBe('5c7ee2074b65853f71fc5a01ce194ff2')
  expect(serialized).toBe(2)
  expect(fallback).toBe(1)
  const circular: { self?: unknown } = {}
  circular.self = circular
  expect(hashPayload(circular)).toBe('b28c94b2195c8ed259f0b415aaee3f39')
  const failure = new Error('coercion failed')
  expect(() => hashPayload({ toJSON() { throw failure }, [Symbol.toPrimitive]() { throw failure } })).toThrow(failure)
  for (const payload of [Symbol('invalid'), () => {}, { toJSON() { return undefined } }]) {
    let caught: unknown
    try { hashPayload(payload) }
    catch (error) { caught = error }
    expect(caught).toBeInstanceOf(TypeError)
    expect(caught).toMatchObject({ code: 'ERR_INVALID_ARG_TYPE' })
  }
})

test('quarantine reads existing hashes and keeps mutable payloads and failure counts live', async () => {
  const unlock = await acquireDbConfigLock()
  try {
    await ensureDatabaseConfigLoaded()
    resetDatabaseConnection()
    initializeDbConfig({ app: { env: 'production' }, database: { default: 'sqlite', connections: { sqlite: { database: ':memory:' } }, queryLogging: { enabled: false } } })
    await db.unsafe('CREATE TABLE job_quarantine (id INTEGER PRIMARY KEY, job_name TEXT, payload_hash TEXT, failure_count INTEGER, window_start TEXT, quarantined_at TEXT, UNIQUE(job_name, payload_hash))').execute()
    // This persisted value was produced independently with standard SHA-256.
    const persisted = 'b2b902820ddfbdcf3d183b65202fdcf4'
    await db.insertInto('job_quarantine').values({ job_name: 'LegacyJob', payload_hash: persisted, failure_count: 3, window_start: '2026-09-08 00:00:00', quarantined_at: '2026-09-08 00:00:00' }).execute()
    const payload = { orderId: 42 }
    expect(await isQuarantined('LegacyJob', payload)).toBe(true)
    payload.orderId = 43
    expect(await isQuarantined('LegacyJob', payload)).toBe(false)
    payload.orderId = 42
    await unquarantineJob('LegacyJob')
    expect(await isQuarantined('LegacyJob', payload)).toBe(false)
    expect(await recordFailureForPoison('NewJob', payload, { maxFailures: 3 })).toBe(false)
    expect(await recordFailureForPoison('NewJob', payload, { maxFailures: 3 })).toBe(false)
    expect(await recordFailureForPoison('NewJob', payload, { maxFailures: 3 })).toBe(true)
    expect(await listQuarantined()).toEqual([expect.objectContaining({ job_name: 'NewJob', payload_hash: persisted, failure_count: 3 })])
    await quarantineJob('WildcardJob')
    expect(await isQuarantined('WildcardJob', { other: true })).toBe(true)
  }
  finally {
    try {
      resetDatabaseConnection()
      initializeDbConfig(config)
    }
    finally {
      unlock()
    }
  }
})
