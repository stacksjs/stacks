import { describe, expect, test } from 'bun:test'
import { createEmitter } from '../src/index'

// stacksjs/stacks#1878 E-2 + E-1 — priority-sorted dispatch and
// per-handler Result collection from emitAndCollect.

describe('listener priority (stacksjs/stacks#1878 E-2)', () => {
  test('higher priority runs first', () => {
    const emitter = createEmitter<{ 'thing:happened': { id: number } }>()
    const order: string[] = []

    emitter.on('thing:happened', () => order.push('low'), { priority: -10 })
    emitter.on('thing:happened', () => order.push('default'))
    emitter.on('thing:happened', () => order.push('high'), { priority: 100 })

    emitter.emit('thing:happened', { id: 1 })
    expect(order).toEqual(['high', 'default', 'low'])
  })

  test('same priority preserves insertion order (stable sort)', () => {
    const emitter = createEmitter<{ 'evt': string }>()
    const order: string[] = []

    emitter.on('evt', () => order.push('a'), { priority: 5 })
    emitter.on('evt', () => order.push('b'), { priority: 5 })
    emitter.on('evt', () => order.push('c'), { priority: 5 })

    emitter.emit('evt', 'go')
    expect(order).toEqual(['a', 'b', 'c'])
  })

  test('default priority is 0', () => {
    const emitter = createEmitter<{ 'evt': string }>()
    const order: string[] = []

    emitter.on('evt', () => order.push('positive'), { priority: 1 })
    emitter.on('evt', () => order.push('default'))
    emitter.on('evt', () => order.push('negative'), { priority: -1 })

    emitter.emit('evt', 'go')
    expect(order).toEqual(['positive', 'default', 'negative'])
  })

  test('off() still works after priority is set', () => {
    const emitter = createEmitter<{ 'evt': string }>()
    let fired = false
    const handler = () => { fired = true }

    emitter.on('evt', handler, { priority: 50 })
    emitter.off('evt', handler)

    emitter.emit('evt', 'go')
    expect(fired).toBe(false)
  })
})

describe('emitAndCollect (stacksjs/stacks#1878 E-1)', () => {
  test('returns per-handler Result objects', async () => {
    const emitter = createEmitter<{ 'thing': number }>()

    emitter.on('thing', () => 'ok-a')
    emitter.on('thing', async () => 'ok-b')
    emitter.on('thing', () => { throw new Error('boom') })

    const results = await emitter.emitAndCollect('thing', 42)
    expect(results).toHaveLength(3)
    expect(results[0]).toEqual({ ok: true, value: 'ok-a' })
    expect(results[1]).toEqual({ ok: true, value: 'ok-b' })
    expect(results[2]).toEqual({ ok: false, error: expect.any(Error) })
    if (!results[2]!.ok)
      expect(results[2]!.error.message).toBe('boom')
  })

  test('captures async rejection as a failure result', async () => {
    const emitter = createEmitter<{ 'evt': null }>()

    emitter.on('evt', async () => 'sync-success')
    emitter.on('evt', async () => { throw new Error('async fail') })

    const results = await emitter.emitAndCollect('evt', null)
    expect(results).toHaveLength(2)
    expect(results[0]?.ok).toBe(true)
    expect(results[1]?.ok).toBe(false)
  })

  test('respects priority ordering', async () => {
    const emitter = createEmitter<{ 'evt': null }>()

    emitter.on('evt', () => 'low', { priority: 1 })
    emitter.on('evt', () => 'high', { priority: 10 })
    emitter.on('evt', () => 'default')

    const results = await emitter.emitAndCollect('evt', null)
    const values = results.map(r => r.ok ? r.value : undefined)
    expect(values).toEqual(['high', 'low', 'default'])
  })

  test('returns empty array when no handlers registered', async () => {
    const emitter = createEmitter<{ 'evt': null }>()
    const results = await emitter.emitAndCollect('evt', null)
    expect(results).toEqual([])
  })
})

for (const method of ['emit', 'emitAsync', 'emitAndCollect'] as const) {
  test(`${method} preserves snapshots and priority as handler counts change`, async () => {
    const bus = createEmitter<{ event: null }>()
    const order: string[] = []
    let added = false
    const second = () => { order.push('second'); return 'second' }
    const first = () => {
      order.push('first')
      if (!added) {
        added = true
        bus.on('event', second, { priority: 100 })
      }
      return 'first'
    }
    const emit = () => bus[method]('event', null)
    bus.on('event', first, { priority: -10 })
    await emit()
    // A listener added by the sole handler belongs to the next snapshot.
    expect(order).toEqual(['first'])
    order.length = 0
    await emit()
    expect(order).toEqual(['second', 'first'])
    bus.off('event', second)
    order.length = 0
    await emit()
    expect(order).toEqual(['first'])
    bus.off('event', first)
    order.length = 0
    const empty = await emit()
    expect(order).toEqual([])
    if (method !== 'emit') expect(empty).toEqual([])
    bus.on('event', second, { priority: 100 })
    const last = await emit()
    expect(order).toEqual(['second'])
    if (method === 'emitAsync') expect(last).toEqual(['second'])
    if (method === 'emitAndCollect') expect(last).toEqual([{ ok: true, value: 'second' }])
  })
}

describe('emitAndCollectInPlace', () => {
  test('answers in place when every handler did, in dispatch order', () => {
    const emitter = createEmitter<Record<string, number>>()
    const order: string[] = []
    emitter.on('thing', (value) => { order.push(`exact ${value}`); return undefined })
    emitter.on('thing', () => { order.push('refuses'); return false })
    emitter.on('th*', () => { order.push('pattern') })
    emitter.on('*', () => { order.push('wildcard') })

    const outcomes = emitter.emitAndCollectInPlace('thing', 7)
    expect(Array.isArray(outcomes)).toBe(true)
    expect(order).toEqual(['exact 7', 'refuses', 'pattern', 'wildcard'])
    expect(outcomes).toEqual([
      { ok: true, value: undefined },
      { ok: true, value: false },
      { ok: true, value: undefined },
      { ok: true, value: undefined },
    ])
  })

  test('a handler that throws is an outcome, and the ones after it still run', () => {
    const emitter = createEmitter<Record<string, number>>()
    emitter.on('thing', () => { throw new Error('refused') })
    emitter.on('thing', () => 'still here')

    const outcomes = emitter.emitAndCollectInPlace('thing', 1) as Array<{ ok: boolean, value?: unknown, error?: Error }>
    expect(outcomes.map(outcome => outcome.ok)).toEqual([false, true])
    expect(outcomes[0]!.error?.message).toBe('refused')
    expect(outcomes[1]!.value).toBe('still here')
  })

  test('becomes a promise from the first handler that returns one, and keeps the order', async () => {
    const emitter = createEmitter<Record<string, number>>()
    const order: string[] = []
    emitter.on('thing', () => { order.push('first') })
    emitter.on('thing', async () => {
      await new Promise(resolve => setTimeout(resolve, 5))
      order.push('second, late')
      return false
    })
    emitter.on('thing', () => { order.push('third') })

    const pending = emitter.emitAndCollectInPlace('thing', 1)
    expect(pending).toBeInstanceOf(Promise)
    // The third handler waits for the second, exactly as emitAndCollect has it.
    expect(order).toEqual(['first'])
    const outcomes = await pending
    expect(order).toEqual(['first', 'second, late', 'third'])
    expect(outcomes).toEqual([
      { ok: true, value: undefined },
      { ok: true, value: false },
      { ok: true, value: undefined },
    ])
  })

  test('a rejection is an outcome too', async () => {
    const emitter = createEmitter<Record<string, number>>()
    emitter.on('thing', async () => { throw new Error('later') })
    const outcomes = await emitter.emitAndCollectInPlace('thing', 1) as Array<{ ok: boolean, error?: Error }>
    expect(outcomes[0]!.ok).toBe(false)
    expect(outcomes[0]!.error?.message).toBe('later')
  })

  test('no handlers is an empty answer in place', () => {
    expect(createEmitter<Record<string, number>>().emitAndCollectInPlace('thing', 1)).toEqual([])
  })
})
