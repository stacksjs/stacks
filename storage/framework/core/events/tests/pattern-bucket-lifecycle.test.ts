import { expect, test } from 'bun:test'
import { createEmitter } from '../src/index'

for (const method of ['emit', 'emitAsync', 'emitAndCollect'] as const) {
  test(`${method} matches each pattern when public map entries share a bucket`, async () => {
    const bus = createEmitter<Record<string, unknown>>()
    const seen: string[] = []
    bus.on('user:*', (type) => { seen.push(String(type)) })
    const handlers = bus.all.get('user:*')!
    bus.all.set('post:*', handlers)
    await bus[method]('user:created', null)
    await bus[method]('post:created', null)
    await bus[method]('user:updated', null)
    expect(seen).toEqual(['user:created', 'post:created', 'user:updated'])

    // Moving the same bucket to another key must use the new pattern.
    bus.all.clear()
    bus.all.set('team:*', handlers)
    await bus[method]('post:deleted', null)
    await bus[method]('team:created', null)
    expect(seen).toEqual(['user:created', 'post:created', 'user:updated', 'team:created'])
  })

  test(`${method} follows pattern bucket replacement and removal`, async () => {
    const bus = createEmitter<Record<string, unknown>>()
    const seen: string[] = []
    const first = () => { seen.push('first') }
    const second = () => { seen.push('second') }
    bus.on('user:*', first)
    await bus[method]('user:created', null)
    bus.all.set('user:*', [second])
    await bus[method]('user:created', null)
    bus.off('user:*')
    await bus[method]('user:created', null)
    bus.on('user:*', first)
    await bus[method]('user:created', null)
    bus.removeAllListeners('user:*')
    await bus[method]('user:created', null)
    bus.on('user:*', second)
    await bus[method]('user:created', null)
    bus.removeAllListeners()
    await bus[method]('user:created', null)
    bus.on('user:*', first)
    await bus[method]('user:created', null)
    bus.all.delete('user:*')
    await bus[method]('user:created', null)
    expect(seen).toEqual(['first', 'second', 'first', 'second', 'first'])
  })
}
