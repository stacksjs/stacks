import { expect, test } from 'bun:test'
import { move } from '../src/helpers'

test('invalid moves reject before changing the source array', () => {
  for (const [from, to] of [[50, 0], [-50, 0], [0, 50], [0, -50], [0.5, 1], [0, NaN], [Infinity, 0]]) {
    const source = [1, 2, 3]
    expect(() => move(source, from!, to!)).toThrow(RangeError)
    expect(source).toEqual([1, 2, 3])
  }
})
test('valid moves preserve length, negative indexing, append and the original array', () => {
  expect(move([1, 2, 3], -1, 0)).toEqual([3, 1, 2])
  expect(move([1, 2, 3], 0, -1)).toEqual([2, 3, 1])
  const source = [1, 2, 3]
  expect(move(source, 0, 3)).toBe(source)
  expect(source).toEqual([2, 3, 1])
  const empty: number[] = []
  expect(move(empty, 0, 0)).toBe(empty)
})
