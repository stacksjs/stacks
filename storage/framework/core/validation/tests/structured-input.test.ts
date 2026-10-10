import { expect, test } from 'bun:test'
import { InputValidationError, parseArrayInput, parseObjectInput, parsePositiveIdListInput } from '../src/input'

test('nested input requires a JSON record and bounded actual arrays', () => {
  const record = { weeks: [] }
  expect(parseObjectInput(record, 'plan')).toBe(record)
  expect(parseObjectInput(Object.create(null), 'plan')).toEqual({})
  for (const value of [null, [], true, '{}', new Date(), new Map()]) expect(() => parseObjectInput(value, 'plan')).toThrow(InputValidationError)
  expect(parseArrayInput([], 'weeks', 0, 24)).toEqual([])
  for (const value of [null, {}, '[]', Array(25).fill({})]) expect(() => parseArrayInput(value, 'weeks', 1, 24)).toThrow(InputValidationError)
  for (const bounds of [[-1, 1], [2, 1], [0, Infinity], [0.5, 1]]) expect(() => parseArrayInput([], 'weeks', bounds[0], bounds[1])).toThrow(RangeError)
})

test('resource selections reject the whole invalid list and enforce size before deduplication', () => {
  expect(parsePositiveIdListInput([3, '2', 3, 1], 'athletes')).toEqual([3, 2, 1])
  expect(parsePositiveIdListInput([], 'athletes', 0)).toEqual([])
  for (const value of [[1, false], [1, null], [1, {}], [1, 1.5], [1, Number.MAX_SAFE_INTEGER + 1], Array(101).fill(1), []]) expect(() => parsePositiveIdListInput(value, 'athletes')).toThrow(InputValidationError)
})
