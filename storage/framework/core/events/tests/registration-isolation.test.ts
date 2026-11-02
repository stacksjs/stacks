import { describe, expect, test } from 'bun:test'
import { createEmitter } from '../src/index'

// A registration's priority belongs to that registration, and one listener's
// pattern cannot break dispatch for the others.

describe('one handler registered for two events', () => {
  test('keeps the priority it was given for each', async () => {
    const emitter = createEmitter<Record<string, string>>()
    const order: string[] = []
    const audit = (event: string) => { order.push(`audit ${event}`) }
    emitter.on('order:paid', audit, { priority: 100 })
    emitter.on('order:paid', () => { order.push('ship') })
    emitter.on('user:created', () => { order.push('welcome') })
    emitter.on('user:created', audit, { priority: -10 })

    emitter.emit('order:paid', 'order:paid')
    emitter.emit('user:created', 'user:created')
    expect(order).toEqual(['audit order:paid', 'ship', 'welcome', 'audit user:created'])

    order.length = 0
    await emitter.emitAsync('order:paid', 'order:paid')
    await emitter.emitAndCollect('user:created', 'user:created')
    expect(order).toEqual(['audit order:paid', 'ship', 'welcome', 'audit user:created'])
  })

  test('a registration without a priority does not inherit another one\'s', () => {
    const emitter = createEmitter<Record<string, string>>()
    const order: string[] = []
    const audit = () => { order.push('audit') }
    emitter.on('a', audit, { priority: 100 })
    emitter.on('b', () => { order.push('first') })
    emitter.on('b', audit)
    emitter.emit('b', 'b')
    expect(order).toEqual(['first', 'audit'])
  })
})

describe('pattern keys', () => {
  test('a pattern that is not a valid regular expression does not break other events', async () => {
    const emitter = createEmitter<Record<string, string>>()
    const seen: string[] = []
    emitter.on('report[*', () => { seen.push('pattern') })
    emitter.on('ok', () => { seen.push('ok') })
    expect(() => emitter.emit('ok', 'x')).not.toThrow()
    await emitter.emitAsync('ok', 'x')
    await emitter.emitAndCollect('ok', 'x')
    emitter.emit('report[42', 'x')
    expect(seen).toEqual(['ok', 'ok', 'ok', 'pattern'])
  })

  test('regular expression characters other than * and . are literal', () => {
    const emitter = createEmitter<Record<string, string>>()
    const seen: string[] = []
    emitter.on('cart+promo:*', (type) => { seen.push(String(type)) })
    emitter.on('user?:*', (type) => { seen.push(String(type)) })
    emitter.emit('cart+promo:applied', 'x')
    emitter.emit('cartttpromo:applied', 'x')
    emitter.emit('user?:created', 'x')
    emitter.emit('use:created', 'x')
    expect(seen).toEqual(['cart+promo:applied', 'user?:created'])
  })

  test('. still matches any character, as *.created has always relied on', () => {
    const emitter = createEmitter<Record<string, string>>()
    const seen: string[] = []
    emitter.on('*.created', (type) => { seen.push(String(type)) })
    emitter.emit('user:created', 'x')
    expect(seen).toEqual(['user:created'])
  })
})
