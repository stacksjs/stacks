import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { EncryptedSessionStore } from '../src/encrypted-session-store'

// stacksjs/stacks#1878 Se-4 — pins the encrypted-session-store
// contract: AES-GCM wrap on set/touch, decrypt on get, pass-through
// for destroy/length/clear, graceful null on decrypt failure.

// Test passphrase. Real apps use APP_KEY; we override per-test so
// the test runner doesn't need a global env var.
const TEST_KEY = 'base64:dGVzdC1wYXNzcGhyYXNlLXdpdGgtMzItYnl0ZXM='

class InMemoryStore {
  store = new Map<string, unknown>()

  async get(sid: string): Promise<any> {
    return (this.store.get(sid) as any) ?? null
  }

  async set(sid: string, value: unknown): Promise<void> {
    this.store.set(sid, value)
  }

  async touch(sid: string, value: unknown): Promise<void> {
    this.store.set(sid, value)
  }

  async destroy(sid: string): Promise<void> {
    this.store.delete(sid)
  }

  async all(): Promise<Record<string, unknown>> {
    return Object.fromEntries(this.store.entries())
  }

  async length(): Promise<number> {
    return this.store.size
  }

  async clear(): Promise<void> {
    this.store.clear()
  }
}

describe('EncryptedSessionStore (stacksjs/stacks#1878 Se-4)', () => {
  let inner: InMemoryStore
  let store: EncryptedSessionStore

  beforeEach(() => {
    inner = new InMemoryStore()
    store = new EncryptedSessionStore(inner as any, { appKey: TEST_KEY })
  })

  afterEach(() => {
    inner.store.clear()
  })

  test('set() writes an encrypted envelope; raw store does NOT have plaintext', async () => {
    await store.set('sid-1', { id: 'sid-1', userId: 42, secret: 'shh' } as any)

    const raw = inner.store.get('sid-1') as Record<string, unknown>
    expect(raw._enc).toBe(true)
    expect(typeof raw.data).toBe('string')
    // The plaintext "shh" must not appear anywhere in the envelope
    // (a quick "did we forget to encrypt something" check).
    expect(JSON.stringify(raw)).not.toContain('shh')
  })

  test('get() decrypts back to the original payload', async () => {
    const original = { id: 'sid-1', userId: 42, custom: { nested: true } } as any
    await store.set('sid-1', original)

    const recovered = await store.get('sid-1')
    expect(recovered).toEqual(original)
  })

  test('SID is preserved in plaintext for middleware SID-match', async () => {
    await store.set('sid-1', { id: 'sid-1', userId: 42 } as any)
    const raw = inner.store.get('sid-1') as Record<string, unknown>
    expect(raw.id).toBe('sid-1')
  })

  test('get() on missing sid returns null', async () => {
    const result = await store.get('nope')
    expect(result).toBeNull()
  })

  test('get() on corrupted ciphertext returns null (no crash)', async () => {
    inner.store.set('broken', { _enc: true, id: 'broken', data: 'not-valid-ciphertext' })
    const result = await store.get('broken')
    expect(result).toBeNull()
  })

  test('get() on pre-wrapper plaintext payload returns as-is (migration path)', async () => {
    const plain = { id: 'sid-old', userId: 7, legacy: true }
    inner.store.set('sid-old', plain)

    const result = await store.get('sid-old')
    expect(result).toEqual(plain as any)
  })

  test('touch() also encrypts', async () => {
    await store.touch('sid-1', { id: 'sid-1', refreshed: true } as any)
    const raw = inner.store.get('sid-1') as Record<string, unknown>
    expect(raw._enc).toBe(true)
  })

  test('destroy() passes through', async () => {
    await store.set('sid-1', { id: 'sid-1' } as any)
    await store.destroy('sid-1')
    expect(inner.store.has('sid-1')).toBe(false)
  })

  test('all() decrypts every entry', async () => {
    await store.set('a', { id: 'a', userId: 1 } as any)
    await store.set('b', { id: 'b', userId: 2 } as any)

    const all = await store.all()
    expect(all.a).toEqual({ id: 'a', userId: 1 } as any)
    expect(all.b).toEqual({ id: 'b', userId: 2 } as any)
  })

  test('length() and clear() pass through', async () => {
    await store.set('a', { id: 'a' } as any)
    await store.set('b', { id: 'b' } as any)

    expect(await store.length()).toBe(2)
    await store.clear()
    expect(await store.length()).toBe(0)
  })
})
