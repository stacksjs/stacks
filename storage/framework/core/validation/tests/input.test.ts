import { describe, expect, test } from 'bun:test'
import { InputValidationError, parseBooleanInput, parseNumberInput, parsePositiveId, parseTextInput, readJsonObject, validateModelInput } from '../src/input'
import { schema } from '../src/runtime'

describe('custom action input', () => {
  test('accepts JSON objects and rejects invalid JSON and non-object bodies', async () => {
    expect(await readJsonObject(new Request('http://localhost', { method: 'POST', body: '{"zero":0,"enabled":false}' }))).toEqual({ zero: 0, enabled: false })
    for (const body of ['null', '[]', 'true', '1', '"text"', '{', '']) {
      await expect(readJsonObject(new Request('http://localhost', { method: 'POST', body }))).rejects.toBeInstanceOf(InputValidationError)
    }
  })
  test('identifiers cannot be boolean, fractional, negative or unsafe integers', () => {
    expect(parsePositiveId('12')).toBe(12)
    for (const value of [true, false, {}, [], '', ' ', null, -1, 0, 1.5, Infinity, Number.MAX_SAFE_INTEGER + 1]) expect(() => parsePositiveId(value)).toThrow(InputValidationError)
    try { parsePositiveId(false) }
    catch (error) { expect((error as InputValidationError).status).toBe(422) }
  })
  test('text is trimmed, nullable and never implicitly coerced or truncated', () => {
    expect(parseTextInput('  name  ', 'name', true)).toBe('name')
    expect(parseTextInput('', 'description')).toBeNull()
    expect(parseTextInput(null, 'description')).toBeNull()
    for (const value of [{}, [], true, 7]) expect(() => parseTextInput(value, 'name')).toThrow(InputValidationError)
    expect(() => parseTextInput(' ', 'name', true)).toThrow(InputValidationError)
  })
  test('numbers preserve zero and decimals and reject coercion and unsafe whole values', () => {
    expect(parseNumberInput(0, 'count', 0, 100, true)).toBe(0)
    expect(parseNumberInput('12.5', 'rate', 0, 100)).toBe(12.5)
    expect(parseNumberInput(null, 'count', 0, 100)).toBeNull()
    for (const value of [true, {}, [], ' ', Infinity, -1, 101]) expect(() => parseNumberInput(value, 'count', 0, 100)).toThrow(InputValidationError)
    expect(() => parseNumberInput(1.5, 'count', 0, 100, true)).toThrow(InputValidationError)
    expect(() => parseNumberInput(Number.MAX_SAFE_INTEGER + 1, 'count', 0, Infinity, true)).toThrow(InputValidationError)
  })
  test('form booleans preserve explicit false and reject malformed consent', () => {
    for (const value of [true, 'true', 1, '1']) expect(parseBooleanInput(value, 'enabled')).toBe(true)
    for (const value of [false, 'false', 0, '0']) expect(parseBooleanInput(value, 'enabled')).toBe(false)
    expect(parseBooleanInput(undefined, 'enabled')).toBeUndefined()
    for (const value of [null, '', 'yes', {}, [], 2]) expect(() => parseBooleanInput(value, 'enabled')).toThrow(InputValidationError)
  })
  test('partial input follows declared model rules without requiring omitted fields', () => {
    const model = { getDefinition: () => ({ attributes: { name: { validation: { rule: schema.string().required().max(5) } }, count: { validation: { rule: schema.integer().min(0) } } } }) }
    expect(() => validateModelInput(model, { count: 0 })).not.toThrow()
    expect(() => validateModelInput(model, { name: 'longer' })).toThrow(InputValidationError)
    expect(() => validateModelInput(model, { count: true })).toThrow(InputValidationError)
  })
})
