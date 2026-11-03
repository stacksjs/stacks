import { expect, test } from 'bun:test'
import { omit, setPath } from '../src/transform'
import { objectMap } from '../src'

test('omit normalizes numeric exclusions to JavaScript property keys', () => {
  expect(omit({ 1: 'secret', 2: 'public' }, [1])).toEqual({ 2: 'public' })
  expect(omit({ 0: 'zero', '-1': 'negative', keep: true }, [0, '-1'])).toEqual({ keep: true })
})

test('path updates preserve holes and own named array siblings without mutating the source', () => {
  const symbol = Symbol('tag')
  const source = Object.assign(Array<string>(4), { label: 'keep', [symbol]: true })
  source[2] = 'old'
  Object.defineProperty(source, '__proto__', { value: 'data', enumerable: true })
  const result = setPath(source, [2], 'new')
  expect(result).toHaveLength(4)
  expect(Object.hasOwn(result, 0)).toBe(false)
  expect(Object.hasOwn(result, 1)).toBe(false)
  expect(Object.hasOwn(result, 3)).toBe(false)
  expect(result.label).toBe('keep')
  expect(result[symbol]).toBe(true)
  expect(Object.getOwnPropertyDescriptor(result, '__proto__')?.value).toBe('data')
  expect(Object.getPrototypeOf(result)).toBe(Array.prototype)
  expect(source[2]).toBe('old')
  expect(result[2]).toBe('new')
  expect(setPath(source, ['length'], 1)).toHaveLength(1)
  expect(Object.hasOwn(source, 0)).toBe(false)
})

test('filtering objectMap removes keys and keeps safe transformed property names', () => {
  expect(objectMap({ account: 'owner' }, () => undefined)).toEqual({})
  const result = objectMap({ a: 1 }, () => ['__proto__', 2])
  expect(Object.hasOwn(result, '__proto__')).toBe(true)
  expect(Object.getPrototypeOf(result)).toBe(Object.prototype)
})


test('path copies normalize key aliases while preserving unrelated named array fields', () => {
  expect(setPath({ 1: 123 }, ['1'], 'text')[1]).toBe('text')
  expect(setPath({ '1': 123 }, [1], 'text')['1']).toBe('text')
  const source = Object.assign([1], { '-1': 'negative', '1.5': 'fraction', '01': 'leading', '4294967295': 'edge' })
  const result = setPath(source, [0], 2)
  expect(result[-1]).toBe('negative')
  expect(result[1.5]).toBe('fraction')
  expect(result['01']).toBe('leading')
  expect(result[4294967295]).toBe('edge')
  expect(setPath(source, [-1], true)[-1]).toBe(true)
  expect(source[-1]).toBe('negative')
  for (const key of ['a', 'b'] as const) {
    const changed = setPath({ a: 1, b: 2 }, [key], 'text')
    expect(changed[key]).toBe('text')
    expect(changed[key === 'a' ? 'b' : 'a']).toBe(key === 'a' ? 2 : 1)
  }
})
