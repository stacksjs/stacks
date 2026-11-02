import { expect, test } from 'bun:test'
import { InputValidationError, parseBooleanInput, storedBoolean } from '../src/input'

test('a checkbox\'s on and off are booleans', () => {
  expect(parseBooleanInput('on', 'remember')).toBe(true)
  expect(parseBooleanInput('off', 'remember')).toBe(false)
  expect(storedBoolean('on', false)).toBe(true)
  for (const value of ['yes', 'ON', 'checked', {}])
    expect(() => parseBooleanInput(value, 'remember')).toThrow(InputValidationError)
})
