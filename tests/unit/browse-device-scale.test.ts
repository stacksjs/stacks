import { expect, test } from 'bun:test'
import { parseDeviceScale } from '../../storage/framework/defaults/ai/skills/stacks-browse/scripts/browse'

test('browser device scale defaults to one and accepts explicit positive finite ratios', () => {
  expect(parseDeviceScale(undefined)).toBe(1)
  expect(parseDeviceScale('2')).toBe(2)
  expect(parseDeviceScale('1.5')).toBe(1.5)
  expect(parseDeviceScale('0.75')).toBe(0.75)
})

test('missing, repeated, non-numeric and non-positive device scales fail explicitly', () => {
  for (const value of [true, false, '', '0', '-1', 'NaN', 'Infinity', '1e309', '2x', ['1', '2']]) expect(() => parseDeviceScale(value)).toThrow(TypeError)
})
