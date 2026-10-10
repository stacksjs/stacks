import { expect, test } from 'bun:test'
import { InputValidationError, parseEnumInput, parseTextInput, positiveIdOrNull, storedBoolean, validateModelInput } from '../src/input'

test('bounded text refuses truncation and enums refuse coercion', () => {
  expect(parseTextInput('  ab  ', 'name', true, 2)).toBe('ab')
  expect(() => parseTextInput('abc', 'name', true, 2)).toThrow(InputValidationError)
  for (const value of [true, {}, 1, null]) expect(() => parseEnumInput(value, 'status', ['active', 'inactive'])).toThrow(InputValidationError)
  expect(parseEnumInput('active', 'status', ['active', 'inactive'])).toBe('active')
})
test('stored booleans preserve SQL false and use the caller-selected fallback', () => {
  for (const value of [false, 'false', 0, '0']) expect(storedBoolean(value, true)).toBe(false)
  for (const value of [true, 'true', 1, '1']) expect(storedBoolean(value, false)).toBe(true)
  for (const value of [null, undefined, {}, 'invalid']) {
    expect(storedBoolean(value, true)).toBe(true)
    expect(storedBoolean(value, false)).toBe(false)
  }
})
test('partial model validation finds snake-case columns for camel-case attributes', () => {
  const model = { getDefinition: () => ({ attributes: { displayName: { validation: { rule: { validate: (value: unknown) => ({ valid: typeof value === 'string' && value.length <= 3 }) } } } } }) }
  expect(() => validateModelInput(model, { display_name: 'long' })).toThrow(InputValidationError)
  expect(() => validateModelInput(model, { displayName: 'long' })).toThrow(InputValidationError)
  expect(() => validateModelInput(model, {})).not.toThrow()
})

test('nullable identifiers retain valid form IDs without boolean or unsafe-number coercion', () => {
  expect(positiveIdOrNull('42')).toBe(42)
  for (const value of [null, undefined, true, {}, [], 0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1]) expect(positiveIdOrNull(value)).toBeNull()
})
