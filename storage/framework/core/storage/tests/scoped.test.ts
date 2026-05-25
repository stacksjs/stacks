import { describe, expect, test } from 'bun:test'
import { InMemoryStorageAdapter } from '../src/adapters/memory'
import { ScopedStorageAdapter, scoped } from '../src/adapters/scoped'

// stacksjs/stacks#1887 S-11 — per-tenant prefix scoping wrapper.

describe('ScopedStorageAdapter', () => {
  test('writes are prefixed with the scope on the underlying disk', async () => {
    const inner = new InMemoryStorageAdapter()
    const tenant = new ScopedStorageAdapter(inner, { scope: 'tenant-1' })

    await tenant.write('avatar.jpg', new Uint8Array([1, 2, 3]))

    // Underlying store sees the scoped key
    expect(await inner.fileExists('tenant-1/avatar.jpg')).toBe(true)
    // Caller's view is the unscoped key
    expect(await tenant.fileExists('avatar.jpg')).toBe(true)
  })

  test('PutResult.path is unscoped for the caller', async () => {
    const inner = new InMemoryStorageAdapter()
    const tenant = new ScopedStorageAdapter(inner, { scope: 'tenant-42' })

    const result = await tenant.write('foo/bar.txt', 'hello')
    expect(result.path).toBe('foo/bar.txt')
  })

  test('stat() strips the scope prefix in the return', async () => {
    const inner = new InMemoryStorageAdapter()
    const tenant = new ScopedStorageAdapter(inner, { scope: 'tenant-1' })

    await tenant.write('a/b/c.txt', 'data')
    const entry = await tenant.stat('a/b/c.txt')
    expect(entry.path).toBe('a/b/c.txt')
  })

  test('cross-tenant isolation: tenant-A cannot see tenant-B files', async () => {
    const inner = new InMemoryStorageAdapter()
    const a = new ScopedStorageAdapter(inner, { scope: 'tenant-a' })
    const b = new ScopedStorageAdapter(inner, { scope: 'tenant-b' })

    await a.write('secret.txt', 'a-secret')
    await b.write('secret.txt', 'b-secret')

    expect(await a.readToString('secret.txt')).toBe('a-secret')
    expect(await b.readToString('secret.txt')).toBe('b-secret')
  })

  test('rejects path traversal that would escape the scope', async () => {
    const inner = new InMemoryStorageAdapter()
    const tenant = new ScopedStorageAdapter(inner, { scope: 'tenant-1' })

    expect(() => tenant.write('../tenant-2/escape.txt', 'data')).toThrow(/'..'/)
    expect(() => tenant.read('../outside.txt')).toThrow(/'..'/)
  })

  test('rejects absolute paths', async () => {
    const inner = new InMemoryStorageAdapter()
    const tenant = new ScopedStorageAdapter(inner, { scope: 'tenant-1' })
    expect(() => tenant.write('/etc/passwd', 'no')).toThrow(/absolute/)
  })

  test('rejects null bytes in paths', async () => {
    const inner = new InMemoryStorageAdapter()
    const tenant = new ScopedStorageAdapter(inner, { scope: 'tenant-1' })
    expect(() => tenant.write('foo\0bar.txt', 'no')).toThrow(/null byte/)
  })

  test('rejects malformed scope ids', () => {
    const inner = new InMemoryStorageAdapter()
    expect(() => new ScopedStorageAdapter(inner, { scope: '../escape' })).toThrow()
    expect(() => new ScopedStorageAdapter(inner, { scope: 'has spaces' })).toThrow()
    expect(() => new ScopedStorageAdapter(inner, { scope: 'has/slash' })).toThrow()
    expect(() => new ScopedStorageAdapter(inner, { scope: '' })).toThrow()
  })

  test('accepts alphanumeric + dash + underscore by default', () => {
    const inner = new InMemoryStorageAdapter()
    expect(() => new ScopedStorageAdapter(inner, { scope: 'tenant-42' })).not.toThrow()
    expect(() => new ScopedStorageAdapter(inner, { scope: 'user_1234' })).not.toThrow()
    expect(() => new ScopedStorageAdapter(inner, { scope: 'ORG-ABC' })).not.toThrow()
  })

  test('custom scopePattern allows UUIDs etc.', () => {
    const inner = new InMemoryStorageAdapter()
    const uuidScope = new ScopedStorageAdapter(inner, {
      scope: '8d3f70a4-2c6a-4f5e-9e1d-5b6f7e8a9c0d',
      scopePattern: /^[a-z0-9-]+$/,
    })
    expect(uuidScope).toBeDefined()
  })

  test('streaming methods scope correctly', async () => {
    const inner = new InMemoryStorageAdapter()
    const tenant = new ScopedStorageAdapter(inner, { scope: 'tenant-1' })

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode('streamed'))
        controller.close()
      },
    })
    const result = await tenant.putStream!('s.txt', stream)
    expect(result.path).toBe('s.txt') // caller sees unscoped
    expect(await inner.readToString('tenant-1/s.txt')).toBe('streamed')
  })

  test('list() strips the scope from returned entry paths', async () => {
    const inner = new InMemoryStorageAdapter()
    const tenant = new ScopedStorageAdapter(inner, { scope: 'tenant-1' })

    await tenant.write('docs/one.txt', '1')
    await tenant.write('docs/two.txt', '2')

    const entries: string[] = []
    for await (const e of tenant.list('docs')) entries.push(e.path)
    expect(entries.length).toBeGreaterThan(0)
    // None of the caller-visible paths should leak the scope prefix
    for (const p of entries) expect(p.startsWith('tenant-1/')).toBe(false)
  })

  test('scoped() convenience function works', () => {
    const inner = new InMemoryStorageAdapter()
    const tenant = scoped(inner, { scope: 'tenant-1' })
    expect(tenant instanceof ScopedStorageAdapter).toBe(true)
  })

  test('move/copy stay within scope on both ends', async () => {
    const inner = new InMemoryStorageAdapter()
    const tenant = new ScopedStorageAdapter(inner, { scope: 'tenant-1' })

    await tenant.write('src.txt', 'data')
    await tenant.copyFile('src.txt', 'dst.txt')
    expect(await inner.fileExists('tenant-1/dst.txt')).toBe(true)
    expect(await inner.fileExists('tenant-2/dst.txt')).toBe(false)
  })
})
