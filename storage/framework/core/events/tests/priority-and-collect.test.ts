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
