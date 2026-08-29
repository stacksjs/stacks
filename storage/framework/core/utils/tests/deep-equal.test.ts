import { describe, expect, it } from 'bun:test'
import { isDeepEqual } from '../src/equal'

/**
 * `isDeepEqual` compares values by what they hold.
 *
 * It had branches for arrays and plain objects only, so every other object
 * fell through to an `Object.is` tail - which for an object means reference
 * identity. `isDeepEqual(new Date(0), new Date(0))` was false, and so were two
 * equal `/a/g`s, two Maps with the same entries and two Sets with the same
 * members.
 *
 * A Date nested anywhere took the whole comparison down with it, which is how
 * it stayed unnoticed: the common shapes are objects and arrays, and those
 * worked. There were no tests for this function at all.
 */

describe('dates', () => {
  it('compares by instant, not identity', () => {
    expect(isDeepEqual(new Date(0), new Date(0))).toBe(true)
    expect(isDeepEqual(new Date(0), new Date(1))).toBe(false)
  })

  it('treats two Invalid Dates as equal', () => {
    // An Invalid Date's time value is NaN, and NaN-safety is this function's
    // stated contract. A deliberate divergence from assert.deepStrictEqual.
    expect(isDeepEqual(new Date('nonsense'), new Date('other nonsense'))).toBe(true)
    expect(isDeepEqual(new Date('nonsense'), new Date(0))).toBe(false)
  })
})

describe('regular expressions', () => {
  it('compares pattern and flags', () => {
    expect(isDeepEqual(/a+/g, /a+/g)).toBe(true)
    expect(isDeepEqual(/a/g, /a/i)).toBe(false)
    expect(isDeepEqual(/a/g, /b/g)).toBe(false)
  })

  it('ignores lastIndex, which is iteration state', () => {
    const used = /a/g
    used.lastIndex = 5

    expect(isDeepEqual(used, /a/g)).toBe(true)
  })
})

describe('maps', () => {
  it('compares entries regardless of insertion order', () => {
    expect(isDeepEqual(new Map([['a', 1]]), new Map([['a', 1]]))).toBe(true)
    expect(isDeepEqual(new Map([['a', 1], ['b', 2]]), new Map([['b', 2], ['a', 1]]))).toBe(true)
    expect(isDeepEqual(new Map([['a', 1]]), new Map([['a', 2]]))).toBe(false)
    expect(isDeepEqual(new Map([['a', 1]]), new Map([['b', 1]]))).toBe(false)
    expect(isDeepEqual(new Map([['a', 1]]), new Map([['a', 1], ['b', 2]]))).toBe(false)
  })

  it('compares values deeply', () => {
    expect(isDeepEqual(new Map([['a', { x: [1] }]]), new Map([['a', { x: [1] }]]))).toBe(true)
    expect(isDeepEqual(new Map([['a', { x: [1] }]]), new Map([['a', { x: [2] }]]))).toBe(false)
  })

  it('compares object keys structurally, since no lookup can find them', () => {
    expect(isDeepEqual(new Map([[{ k: 1 }, 'v']]), new Map([[{ k: 1 }, 'v']]))).toBe(true)
    expect(isDeepEqual(new Map([[{ k: 1 }, 'v']]), new Map([[{ k: 2 }, 'v']]))).toBe(false)
  })

  it('matches a NaN key with itself', () => {
    expect(isDeepEqual(new Map([[Number.NaN, 1]]), new Map([[Number.NaN, 1]]))).toBe(true)
  })
})

describe('sets', () => {
  it('compares members regardless of order', () => {
    expect(isDeepEqual(new Set([1, 2]), new Set([2, 1]))).toBe(true)
    expect(isDeepEqual(new Set([1]), new Set([2]))).toBe(false)
    expect(isDeepEqual(new Set([1]), new Set([1, 2]))).toBe(false)
  })

  it('compares members deeply', () => {
    expect(isDeepEqual(new Set([{ a: 1 }]), new Set([{ a: 1 }]))).toBe(true)
  })

  it('does not answer for two members with one', () => {
    // Sizes differ, and the single left-hand member must not match both.
    expect(isDeepEqual(new Set([{ a: 1 }]), new Set([{ a: 1 }, { a: 1 }]))).toBe(false)
  })
})

describe('binary data', () => {
  it('compares typed arrays by their bytes', () => {
    expect(isDeepEqual(new Uint8Array([1, 2]), new Uint8Array([1, 2]))).toBe(true)
    expect(isDeepEqual(new Uint8Array([1, 2]), new Uint8Array([1, 3]))).toBe(false)
    expect(isDeepEqual(new Uint8Array([1]), new Uint8Array([1, 2]))).toBe(false)
  })

  it('does not equate different view types over the same bytes', () => {
    expect(isDeepEqual(new Uint8Array([1]), new Int8Array([1]))).toBe(false)
  })

  it('compares ArrayBuffers by their bytes', () => {
    expect(isDeepEqual(new ArrayBuffer(4), new ArrayBuffer(4))).toBe(true)
    expect(isDeepEqual(new ArrayBuffer(4), new ArrayBuffer(8))).toBe(false)
  })
})

describe('nesting', () => {
  it('reaches these types wherever they sit', () => {
    expect(isDeepEqual({ d: new Date(0) }, { d: new Date(0) })).toBe(true)
    expect(isDeepEqual([new Date(0)], [new Date(0)])).toBe(true)
    expect(isDeepEqual({ m: new Map([['a', 1]]) }, { m: new Map([['a', 1]]) })).toBe(true)
    expect(isDeepEqual(
      { a: [new Date(0), /x/g, new Set([1])] },
      { a: [new Date(0), /x/g, new Set([1])] },
    )).toBe(true)
  })
})

describe('what already worked, and must keep working', () => {
  it('compares arrays and plain objects', () => {
    expect(isDeepEqual([1, 2, 3], [1, 2, 3])).toBe(true)
    expect(isDeepEqual([1, 2], [1, 2, 3])).toBe(false)
    expect(isDeepEqual({ a: { b: [1, 2] } }, { a: { b: [1, 2] } })).toBe(true)
    expect(isDeepEqual({ a: 1 }, { a: 1, b: 2 })).toBe(false)
  })

  it('is NaN-safe and distinguishes null from undefined', () => {
    expect(isDeepEqual(Number.NaN, Number.NaN)).toBe(true)
    expect(isDeepEqual(null, undefined)).toBe(false)
  })

  it('separates values of different types', () => {
    expect(isDeepEqual(new Date(0), {})).toBe(false)
  })

  it('terminates on circular structures', () => {
    const a: Record<string, unknown> = {}
    a.self = a
    const b: Record<string, unknown> = {}
    b.self = b
    expect(isDeepEqual(a, b)).toBe(true)

    const mapA = new Map<string, unknown>()
    mapA.set('self', mapA)
    const mapB = new Map<string, unknown>()
    mapB.set('self', mapB)
    expect(isDeepEqual(mapA, mapB)).toBe(true)
  })
})

describe('types it deliberately leaves alone', () => {
  it('compares Errors and host objects by identity', () => {
    // Unlike the types above these have no single obvious structural identity
    // - whether two Errors with the same message but different stacks are
    // "equal" is a policy question - and the list of them has no end.
    const error = new Error('x')

    expect(isDeepEqual(error, error)).toBe(true)
    expect(isDeepEqual(new Error('x'), new Error('x'))).toBe(false)
  })
})
