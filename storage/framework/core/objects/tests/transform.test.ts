import { describe, expect, it } from 'bun:test'
import { objectMap } from '../src/index'
import {
  getPath,
  invert,
  isEmptyObject,
  mapKeys,
  mapValues,
  omit,
  omitBy,
  pickBy,
  setPath,
} from '../src/transform'

/**
 * None of these mutate. Asserted with a shared helper rather than in prose,
 * because an accidental in-place write is the failure this file is most likely
 * to develop and it would pass every value assertion below.
 */
function unchanged<T extends object>(input: T, run: (input: T) => unknown): void {
  const before = structuredClone(input)
  run(input)
  expect(input).toEqual(before)
}

describe('omit', () => {
  it('removes the given keys', () => {
    expect(omit({ a: 1, b: 2, c: 3 }, ['b'])).toEqual({ a: 1, c: 3 })
    expect(omit({ a: 1 }, [])).toEqual({ a: 1 })
  })

  it('ignores keys that are not there, so a superset is safe', () => {
    expect(omit({ a: 1 } as { a: number, b?: number }, ['b'])).toEqual({ a: 1 })
  })

  it('does not reach into the prototype', () => {
    const parent = { inherited: 'no' }
    const child = Object.create(parent) as { own: number }
    child.own = 1

    expect(omit(child, [])).toEqual({ own: 1 })
  })

  it('does not mutate', () => {
    unchanged({ a: 1, b: 2 }, input => omit(input, ['a']))
  })
})

describe('pickBy and omitBy', () => {
  it('keep and drop by the predicate', () => {
    expect(pickBy({ a: 1, b: 2 }, value => value > 1)).toEqual({ b: 2 })
    expect(omitBy({ a: 1, b: 2 }, value => value > 1)).toEqual({ a: 1 })
  })

  it('are complements, so one predicate partitions the object', () => {
    const source = { a: 1, b: 2, c: 3 }
    const predicate = (value: number): boolean => value % 2 === 1

    expect({ ...pickBy(source, predicate), ...omitBy(source, predicate) }).toEqual(source)
  })

  it('pass the key', () => {
    expect(pickBy({ keep: 1, drop: 2 }, (_value, key) => key === 'keep')).toEqual({ keep: 1 })
  })

  it('drop undefined values, which is the common use', () => {
    expect(omitBy({ a: 1, b: undefined }, value => value === undefined)).toEqual({ a: 1 })
  })
})

describe('mapValues', () => {
  it('replaces values and leaves keys alone', () => {
    expect(mapValues({ a: 1, b: 2 }, value => value * 10)).toEqual({ a: 10, b: 20 })
  })

  it('can change the value type, and the result type follows', () => {
    const stringified: { a: string, b: string } = mapValues({ a: 1, b: 2 }, value => String(value))
    expect(stringified).toEqual({ a: '1', b: '2' })
  })

  it('passes the key, and handles an empty object', () => {
    expect(mapValues({ a: 1 }, (value, key) => `${key}:${value}`)).toEqual({ a: 'a:1' })
    expect(mapValues({}, value => value)).toEqual({})
  })
})

describe('mapKeys', () => {
  it('rewrites keys and leaves values alone', () => {
    expect(mapKeys({ a: 1, b: 2 }, key => key.toUpperCase())).toEqual({ A: 1, B: 2 })
  })

  it('lets the last one win when two keys collide', () => {
    // Matches what an assignment loop does; there is no other sensible answer
    // once two keys have become one.
    expect(mapKeys({ a: 1, b: 2 }, () => 'same')).toEqual({ same: 2 })
  })

  it('passes the value too', () => {
    expect(mapKeys({ a: 1 }, (key, value) => `${key}${value}`)).toEqual({ a1: 1 })
  })
})

describe('invert', () => {
  it('swaps keys and values', () => {
    expect(invert({ a: 'x', b: 'y' })).toEqual({ x: 'a', y: 'b' })
  })

  it('coerces a non-string value into a key, because keys are strings', () => {
    expect(invert({ a: 1 })).toEqual({ 1: 'a' })
  })

  it('collapses duplicate values, last one winning', () => {
    // Which is why this is only meaningful for unique values - said in the
    // docs, pinned here.
    expect(invert({ a: 'same', b: 'same' })).toEqual({ same: 'b' })
  })
})

describe('isEmptyObject', () => {
  it('answers for own enumerable keys', () => {
    expect(isEmptyObject({})).toBe(true)
    expect(isEmptyObject({ a: 1 })).toBe(false)
  })

  it('ignores inherited keys', () => {
    const child = Object.create({ inherited: 1 }) as object
    expect(isEmptyObject(child)).toBe(true)
  })

  it('ignores symbol keys, matching Object.entries', () => {
    expect(isEmptyObject({ [Symbol('s')]: 1 })).toBe(true)
  })
})

describe('getPath', () => {
  const source = { a: { b: [10, 20] }, nullish: null }

  it('walks object keys and array indices', () => {
    expect(getPath(source, ['a', 'b', 1], 0)).toBe(20)
    expect(getPath(source, ['a', 'b'], [])).toEqual([10, 20])
  })

  /**
   * The reason to use this instead of `a?.b?.c`: it cannot throw partway
   * through a partially-populated object.
   */
  it('answers the fallback when a step is missing, without throwing', () => {
    expect(getPath(source, ['a', 'missing', 'deeper'], 'default')).toBe('default')
    expect(getPath(source, ['nullish', 'deeper'], 'default')).toBe('default')
    expect(getPath(undefined, ['a'], 'default')).toBe('default')
  })

  it('answers the fallback for an undefined value, and not for a falsy one', () => {
    expect(getPath({ a: undefined }, ['a'], 'default')).toBe('default')
    expect(getPath({ a: 0 }, ['a'], 'default')).toBe(0)
    expect(getPath({ a: null }, ['a'], 'default')).toBeNull()
  })

  it('returns the source itself for an empty path', () => {
    expect(getPath(source, [], 'default')).toBe(source)
  })

  /**
   * The path is steps rather than a dotted string, which is what lets a key
   * containing a dot be addressed at all.
   */
  it('addresses a key that contains a dot', () => {
    expect(getPath({ 'a.b': 1 }, ['a.b'], 0)).toBe(1)
  })
})

describe('setPath', () => {
  it('replaces a value along an existing path', () => {
    expect(setPath({ a: { b: 1 } }, ['a', 'b'], 2)).toEqual({ a: { b: 2 } })
  })

  it('creates missing steps', () => {
    expect(setPath({}, ['a', 'b'], 1)).toEqual({ a: { b: 1 } })
  })

  it('creates an array for a numeric step, not an object with a "0" key', () => {
    expect(setPath({}, ['items', 0], 'x')).toEqual({ items: ['x'] })
    expect(Array.isArray((setPath({}, ['items', 0], 'x') as { items: unknown }).items)).toBe(true)
  })

  it('updates inside an existing array', () => {
    expect(setPath({ items: [1, 2] }, ['items', 1], 9)).toEqual({ items: [1, 9] })
  })

  it('does not mutate the source', () => {
    unchanged({ a: { b: 1 } }, input => setPath(input, ['a', 'b'], 2))
    unchanged({ items: [1, 2] }, input => setPath(input, ['items', 0], 9))
  })

  /**
   * Only the objects along the path are copied. Sharing the siblings is what
   * makes this cheap enough to call on every update, and is worth pinning so a
   * later "just deep-clone it" does not quietly change the cost.
   */
  it('shares siblings with the original rather than deep-copying', () => {
    const untouched = { large: true }
    const source = { a: { b: 1 }, sibling: untouched }
    const next = setPath(source, ['a', 'b'], 2)

    expect(next.sibling).toBe(untouched)
    expect(next.a).not.toBe(source.a)
  })

  it('replaces the whole value for an empty path', () => {
    expect(setPath({ a: 1 }, [], 'replaced')).toBe('replaced' as never)
  })
})

describe('objectMap return type', () => {
  /**
   * It declared `Record<K, V>` while returning `Record<NK, NV>` - its own
   * docblock example (`(k, v) => [v, k]`, "{ 1: 'a', 2: 'b' }") contradicted
   * its signature. Nothing called it, so the type could simply be corrected.
   */
  it('reports the mapped key and value types, not the original ones', () => {
    const mapped: Record<string, string> = objectMap({ a: 1, b: 2 }, (key, value) => [key.toUpperCase(), String(value)])

    expect(mapped).toEqual({ A: '1', B: '2' })
  })

  it('still swaps keys and values as its documentation claims', () => {
    expect(objectMap({ a: 1, b: 2 }, (key, value) => [value, key])).toEqual({ 1: 'a', 2: 'b' })
  })
})
