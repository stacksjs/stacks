import { expect, test } from 'bun:test'
import { parseEnumListInput, parsePositiveIdListInput } from '../src/input'

test('minimum selection counts apply to distinct enum entries', () => {
  expect(() => parseEnumListInput(['a', 'a'], 'choices', ['a', 'b'], 2)).toThrow()
  expect(parseEnumListInput(['b', 'a', 'b'], 'choices', ['a', 'b'], 2)).toEqual(['b', 'a'])
  expect(parseEnumListInput([], 'choices', ['a'], 0)).toEqual([])
})

test('minimum selection counts apply to distinct canonical IDs', () => {
  expect(() => parsePositiveIdListInput([1, '01'], 'ids', 2)).toThrow()
  expect(parsePositiveIdListInput(['02', 1, 2], 'ids', 2)).toEqual([2, 1])
  expect(parsePositiveIdListInput([], 'ids', 0)).toEqual([])
})
