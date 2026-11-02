import { expect, test } from 'bun:test'
import { parseNumberInput, parseTextInput, validateModelInput } from '../src/input'
import { schema } from '../src/schema'
import { validateWriteBody } from '../../orm/src/auto-crud'

test('decimal inputs retain safe fractions and reject lossy whole numbers', () => {
  expect(parseNumberInput('12.75', 'amount', 0, Infinity)).toBe(12.75)
  expect(parseNumberInput(Number.MAX_SAFE_INTEGER, 'amount', -Infinity, Infinity)).toBe(Number.MAX_SAFE_INTEGER)
  for (const value of ['9007199254740993', 9007199254740992, '-9007199254740993', '1e20'])
    expect(() => parseNumberInput(value, 'amount', -Infinity, Infinity)).toThrow()
})

test('parser configuration is checked even for absent optional input', () => {
  for (const limit of [NaN, Infinity, -1, 1.5]) {
    expect(() => parseTextInput('long text', 'name', false, limit)).toThrow(RangeError)
    expect(() => parseTextInput(null, 'name', false, limit)).toThrow(RangeError)
  }
  for (const [min, max] of [[NaN, 10], [0, NaN], [10, 0], [Infinity, Infinity], [-Infinity, -Infinity]]) {
    expect(() => parseNumberInput(5, 'amount', min!, max!)).toThrow(RangeError)
    expect(() => parseNumberInput(null, 'amount', min!, max!)).toThrow(RangeError)
  }
  expect(parseNumberInput(null, 'amount', -Infinity, Infinity)).toBeNull()
  expect(parseTextInput('', 'name', false, 0)).toBeNull()
})

test('partial model rules see supplied sibling aliases and leave schemas reusable', () => {
  const model = { getDefinition: () => ({ attributes: {
    paymentMethod: { validation: { rule: schema.string() } },
    token: { validation: { rule: schema.string().when('paymentMethod', 'card', rule => rule.min(10)) } },
  } }) }
  for (const values of [{ paymentMethod: 'card', token: 'x' }, { payment_method: 'card', token: 'x' }])
    expect(() => validateModelInput(model, values)).toThrow()
  expect(() => validateModelInput(model, { paymentMethod: 'cash', token: 'x' })).not.toThrow()
  expect(() => validateModelInput(model, { paymentMethod: 'card' })).not.toThrow()
})

test('write conditions see aliases and defaults even on siblings without validators', () => {
  const model = { attributes: {
    paymentMethod: { default: 'card' },
    token: { validation: { rule: schema.string().optional().when('paymentMethod', 'card', rule => rule.required()) } },
  } }
  expect(validateWriteBody({}, model, 'creating').valid).toBe(false)
  expect(validateWriteBody({ payment_method: 'card' }, model, 'creating').valid).toBe(false)
  expect(validateWriteBody({ payment_method: 'cash' }, model, 'creating').valid).toBe(true)
  expect(validateWriteBody({}, model, 'updating').valid).toBe(true)
})
