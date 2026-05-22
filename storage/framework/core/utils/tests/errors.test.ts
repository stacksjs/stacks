import { describe, expect, test } from 'bun:test'
import { getErrorCode, getErrorMessage, getErrorStack, getErrorStatusCode, toError } from '../src/errors'

describe('getErrorMessage (stacksjs/stacks#1875 T-1)', () => {
  test('returns Error.message for real Errors', () => {
    expect(getErrorMessage(new Error('boom'))).toBe('boom')
    expect(getErrorMessage(new TypeError('bad'))).toBe('bad')
  })

  test('returns the string itself for thrown strings', () => {
    expect(getErrorMessage('oops')).toBe('oops')
  })

  test('returns the stringified form for numbers / booleans', () => {
    expect(getErrorMessage(42)).toBe('42')
    expect(getErrorMessage(false)).toBe('false')
  })

  test('duck-types plain objects with a .message property', () => {
    // Common case: an error came over an HTTP boundary and was JSON-decoded,
    // so it's a plain object, not an Error instance.
    expect(getErrorMessage({ message: 'from-the-wire', code: 'EX_1' })).toBe('from-the-wire')
  })

  test('returns "Unknown error" for null / undefined', () => {
    expect(getErrorMessage(null)).toBe('Unknown error')
    expect(getErrorMessage(undefined)).toBe('Unknown error')
  })

  test('falls back to String() for unusual values', () => {
    expect(getErrorMessage(Symbol('x'))).toContain('Symbol')
    expect(getErrorMessage([1, 2])).toBe('1,2')
  })

  test('ignores a non-string .message property', () => {
    expect(getErrorMessage({ message: 123 })).toBe('[object Object]')
  })
})

describe('getErrorStack', () => {
  test('returns the stack for real Errors', () => {
    const e = new Error('with stack')
    expect(getErrorStack(e)).toBeDefined()
    expect(typeof getErrorStack(e)).toBe('string')
  })

  test('returns undefined for non-Error inputs', () => {
    expect(getErrorStack('oops')).toBeUndefined()
    expect(getErrorStack(null)).toBeUndefined()
    expect(getErrorStack(undefined)).toBeUndefined()
    expect(getErrorStack(42)).toBeUndefined()
  })

  test('duck-types plain objects with a .stack property', () => {
    expect(getErrorStack({ stack: 'fake stack' })).toBe('fake stack')
  })
})

describe('getErrorCode', () => {
  test('extracts AWS SDK style .code string', () => {
    expect(getErrorCode({ code: 'AlreadyExistsException', message: 'x' })).toBe('AlreadyExistsException')
  })

  test('extracts Node fs error .code', () => {
    expect(getErrorCode({ code: 'ENOENT', errno: -2 })).toBe('ENOENT')
  })

  test('returns undefined when .code is missing or non-string', () => {
    expect(getErrorCode(new Error('boom'))).toBeUndefined()
    expect(getErrorCode({ code: 42 })).toBeUndefined()
    expect(getErrorCode(null)).toBeUndefined()
    expect(getErrorCode('oops')).toBeUndefined()
  })
})

describe('getErrorStatusCode', () => {
  test('extracts AWS SDK style .statusCode', () => {
    expect(getErrorStatusCode({ statusCode: 404 })).toBe(404)
  })

  test('extracts fetch/Node style .status', () => {
    expect(getErrorStatusCode({ status: 500 })).toBe(500)
  })

  test('prefers statusCode over status when both are present', () => {
    expect(getErrorStatusCode({ statusCode: 404, status: 500 })).toBe(404)
  })

  test('rejects non-finite numbers', () => {
    expect(getErrorStatusCode({ statusCode: Number.NaN })).toBeUndefined()
    expect(getErrorStatusCode({ statusCode: Number.POSITIVE_INFINITY })).toBeUndefined()
  })

  test('returns undefined for primitives and nullish', () => {
    expect(getErrorStatusCode(null)).toBeUndefined()
    expect(getErrorStatusCode('oops')).toBeUndefined()
    expect(getErrorStatusCode(new Error('plain'))).toBeUndefined()
  })
})

describe('toError', () => {
  test('returns Error instances unchanged (identity)', () => {
    const e = new Error('orig')
    expect(toError(e)).toBe(e)
  })

  test('wraps strings in an Error', () => {
    const wrapped = toError('boom')
    expect(wrapped).toBeInstanceOf(Error)
    expect(wrapped.message).toBe('boom')
  })

  test('preserves the original value on .cause', () => {
    const orig = { custom: 'shape', message: 'wire-error' }
    const wrapped = toError(orig)
    expect(wrapped.message).toBe('wire-error')
    expect((wrapped as Error & { cause: unknown }).cause).toBe(orig)
  })

  test('handles null / undefined', () => {
    expect(toError(null).message).toBe('Unknown error')
    expect(toError(undefined).message).toBe('Unknown error')
  })
})
