import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import process from 'node:process'
import { EncryptedSessionStore } from '../src/encrypted-session-store'
import { createStacksSessionStore } from '../src/session-factory'

// stacksjs/stacks#1889 — Stacks-level session factory.
// Verifies driver selection + auto-encryption behavior.

const TEST_KEY = 'base64:dGVzdC1wYXNzcGhyYXNlLXdpdGgtMzItYnl0ZXM='
const SAVED_ENV = { APP_KEY: process.env.APP_KEY, APP_ENV: process.env.APP_ENV, NODE_ENV: process.env.NODE_ENV }

beforeEach(() => {
  process.env.APP_KEY = TEST_KEY
  delete process.env.APP_ENV
  delete process.env.NODE_ENV
})

afterEach(() => {
  process.env.APP_KEY = SAVED_ENV.APP_KEY
  if (SAVED_ENV.APP_ENV) process.env.APP_ENV = SAVED_ENV.APP_ENV; else delete process.env.APP_ENV
  if (SAVED_ENV.NODE_ENV) process.env.NODE_ENV = SAVED_ENV.NODE_ENV; else delete process.env.NODE_ENV
})

describe('createStacksSessionStore', () => {
  test('builds a memory store with encrypt: false (raw)', () => {
    const store = createStacksSessionStore({ driver: 'memory', encrypt: false })
    expect(store).toBeDefined()
    expect(store instanceof EncryptedSessionStore).toBe(false)
  })

  test('wraps with EncryptedSessionStore when encrypt: true', () => {
    const store = createStacksSessionStore({ driver: 'memory', encrypt: true })
    expect(store instanceof EncryptedSessionStore).toBe(true)
  })

  test('auto-encrypts in production', () => {
    process.env.APP_ENV = 'production'
    const store = createStacksSessionStore({ driver: 'memory' })
    expect(store instanceof EncryptedSessionStore).toBe(true)
  })

  test('auto-skips encryption in development', () => {
    process.env.APP_ENV = 'development'
    const store = createStacksSessionStore({ driver: 'memory' })
    expect(store instanceof EncryptedSessionStore).toBe(false)
  })

  test('NODE_ENV=production also triggers auto-encrypt (fallback)', () => {
    process.env.NODE_ENV = 'production'
    const store = createStacksSessionStore({ driver: 'memory' })
    expect(store instanceof EncryptedSessionStore).toBe(true)
  })

  test('APP_ENV wins over NODE_ENV when both are set', () => {
    process.env.APP_ENV = 'staging'
    process.env.NODE_ENV = 'production'
    const store = createStacksSessionStore({ driver: 'memory' })
    expect(store instanceof EncryptedSessionStore).toBe(false)
  })

  test('throws when encryption requested but APP_KEY is missing', () => {
    delete process.env.APP_KEY
    expect(() =>
      createStacksSessionStore({ driver: 'memory', encrypt: true }),
    ).toThrow(/APP_KEY/)
  })

  test('throws when encryption requested but APP_KEY is too short', () => {
    process.env.APP_KEY = 'tiny'
    expect(() =>
      createStacksSessionStore({ driver: 'memory', encrypt: true }),
    ).toThrow(/too short/)
  })

  test('config.appKey overrides env when provided', () => {
    delete process.env.APP_KEY
    const store = createStacksSessionStore({
      driver: 'memory',
      encrypt: true,
      appKey: TEST_KEY,
    })
    expect(store instanceof EncryptedSessionStore).toBe(true)
  })

  test('a roundtrip through the encrypted store preserves payload', async () => {
    const store = createStacksSessionStore({ driver: 'memory', encrypt: true })
    await store.set('sid-1', { id: 'sid-1', userId: 42, custom: 'data' } as any)
    const back = await store.get('sid-1')
    expect(back?.userId).toBe(42)
    expect((back as { custom?: string } | null)?.custom).toBe('data')
  })
})
