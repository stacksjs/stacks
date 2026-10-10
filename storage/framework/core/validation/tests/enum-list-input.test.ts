import { expect, test } from 'bun:test'
import { InputValidationError, parseEnumListInput } from '../src/input'

test('enum lists validate every entry and return an ordered set', () => {
  const choices = ['email', 'sms'] as const
  expect(parseEnumListInput(['sms', 'email', 'sms'], 'channels', choices)).toEqual(['sms', 'email'])
  for (const value of [null, 'email', {}, [], ['email', 'unknown'], ['email', true], ['email', {}]]) {
    expect(() => parseEnumListInput(value, 'channels', choices)).toThrow(InputValidationError)
  }
  expect(() => parseEnumListInput(Array(101).fill('email'), 'channels', choices)).toThrow(InputValidationError)
  expect(parseEnumListInput([], 'channels', choices, 0)).toEqual([])
})
