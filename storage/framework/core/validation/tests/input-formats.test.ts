import { expect, test } from 'bun:test'
import { InputValidationError, parseBooleanInput, parseNumberInput, parsePositiveId, parseTextInput, storedBoolean } from '../src/input'

test('a checkbox\'s on and off are booleans', () => {
  expect(parseBooleanInput('on', 'remember')).toBe(true)
  expect(parseBooleanInput('off', 'remember')).toBe(false)
  expect(storedBoolean('on', false)).toBe(true)
  for (const value of ['yes', 'ON', 'checked', {}])
    expect(() => parseBooleanInput(value, 'remember')).toThrow(InputValidationError)
})

test('identifiers are decimal digits', () => {
  expect(parsePositiveId('42')).toBe(42)
  expect(parsePositiveId(' 7 ')).toBe(7)
  expect(parsePositiveId('007')).toBe(7)
  for (const value of ['0x10', '1e3', '0b11', '+3', '5.0', ''])
    expect(() => parsePositiveId(value)).toThrow(InputValidationError)
})

test('numbers are decimal, and text that is not one says so', () => {
  expect(parseNumberInput('12.5', 'price', 0, 100)).toBe(12.5)
  expect(parseNumberInput('-3', 'delta', -10, 10)).toBe(-3)
  expect(parseNumberInput('1e2', 'price', 0, 1000)).toBe(100)
  for (const value of ['0x10', '0b11', '0o7', 'abc', '12abc', 'Infinity'])
    expect(() => parseNumberInput(value, 'price', 0, 1000)).toThrow('price must be a number')
  expect(() => parseNumberInput('2000', 'price', 0, 1000)).toThrow('price is out of range')
})

test('a text limit counts characters, not UTF-16 units', () => {
  expect(parseTextInput('😀'.repeat(200), 'name', true, 255)).toBe('😀'.repeat(200))
  expect(() => parseTextInput('😀'.repeat(256), 'name', true, 255)).toThrow('name is too long')
})
