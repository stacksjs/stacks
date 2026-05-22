import { describe, expect, test } from 'bun:test'
import { createEmitter, scope } from '../src/index'

// stacksjs/stacks#1878 E-5 — pins the scope() contract:
// dispatches via the scoped wrapper auto-prefix the event name;
// listens registered through the wrapper only see prefixed events;
// the underlying bus sees the prefixed form too (for cross-scope
// auditing via glob).

describe('scope() emitter wrapper (stacksjs/stacks#1878 E-5)', () => {
  test('emits via wrapper appear on underlying bus with prefix', () => {
    const underlying = createEmitter<Record<string, unknown>>()
    const tenant = scope(underlying, 'tenant:42')

    const seen: Array<{ type: string, payload: unknown }> = []
    underlying.on('*' as any, (type: any, payload: any) => {
      seen.push({ type: String(type), payload })
    })

    tenant.emit('user:created', { id: 1 })

    expect(seen).toEqual([{ type: 'tenant:42:user:created', payload: { id: 1 } }])
  })

  test('listens via wrapper receive the prefixed event', () => {
    const underlying = createEmitter<Record<string, unknown>>()
    const tenant = scope(underlying, 'tenant:42')

    const received: unknown[] = []
    tenant.on('user:created', (payload: unknown) => received.push(payload))

    underlying.emit('tenant:42:user:created' as any, { id: 5 })
    expect(received).toEqual([{ id: 5 }])
  })

  test('wrapper listeners do NOT see unprefixed events on the bus', () => {
    const underlying = createEmitter<Record<string, unknown>>()
    const tenant = scope(underlying, 'tenant:42')

    let fired = false
    tenant.on('user:created', () => { fired = true })

    underlying.emit('user:created' as any, { id: 1 })
    expect(fired).toBe(false)
  })

  test('two scopes share the underlying bus without colliding', () => {
    const underlying = createEmitter<Record<string, unknown>>()
    const a = scope(underlying, 'tenant:a')
    const b = scope(underlying, 'tenant:b')

    const aSeen: unknown[] = []
    const bSeen: unknown[] = []
    a.on('user:created', (p: unknown) => aSeen.push(p))
    b.on('user:created', (p: unknown) => bSeen.push(p))

    a.emit('user:created', { tenant: 'a' })
    b.emit('user:created', { tenant: 'b' })

    expect(aSeen).toEqual([{ tenant: 'a' }])
    expect(bSeen).toEqual([{ tenant: 'b' }])
  })

  test('off() removes a previously-listened handler', () => {
    const underlying = createEmitter<Record<string, unknown>>()
    const tenant = scope(underlying, 'tenant:42')

    let fired = false
    const handler = () => { fired = true }
    tenant.on('evt', handler)
    tenant.off('evt', handler)
    tenant.emit('evt', null)

    expect(fired).toBe(false)
  })

  test('emitAsync resolves after handlers finish', async () => {
    const underlying = createEmitter<Record<string, unknown>>()
    const tenant = scope(underlying, 'tenant:42')

    let finished = false
    tenant.on('slow:work', async () => {
      await new Promise(r => setTimeout(r, 20))
      finished = true
    })

    await tenant.emitAsync('slow:work', null)
    expect(finished).toBe(true)
  })

  test('listenerCount counts handlers within the scope', () => {
    const underlying = createEmitter<Record<string, unknown>>()
    const tenant = scope(underlying, 'tenant:42')

    expect(tenant.listenerCount('evt')).toBe(0)
    tenant.on('evt', () => {})
    tenant.on('evt', () => {})
    expect(tenant.listenerCount('evt')).toBe(2)
  })

  test('emitAndCollect respects priority through the scope', async () => {
    const underlying = createEmitter<Record<string, unknown>>()
    const tenant = scope(underlying, 'tenant:42')

    tenant.on('evt', () => 'low', { priority: 1 })
    tenant.on('evt', () => 'high', { priority: 10 })

    const results = await tenant.emitAndCollect('evt', null)
    expect(results.map(r => r.ok ? r.value : null)).toEqual(['high', 'low'])
  })
})
