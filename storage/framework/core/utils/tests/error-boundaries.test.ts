import { expect, test } from 'bun:test'
import { getErrorMessage, getErrorCode, getErrorStack, getErrorStatusCode, toError } from '../src/errors'

test('error extraction never replaces a failure with a throwing getter or revoked proxy', () => {
  const hostile = Object.create(null)
  for (const name of ['message', 'code', 'stack', 'statusCode', 'status', 'toString', Symbol.toPrimitive]) {
    Object.defineProperty(hostile, name, { get() { throw new Error('getter failed') } })
  }
  const { proxy, revoke } = Proxy.revocable({}, {})
  revoke()
  for (const input of [hostile, proxy]) {
    expect(getErrorMessage(input)).toBe('Unknown error')
    expect(getErrorCode(input)).toBeUndefined()
    expect(getErrorStack(input)).toBeUndefined()
    expect(getErrorStatusCode(input)).toBeUndefined()
    const result = toError(input)
    expect(result.message).toBe('Unknown error')
    expect(result.cause).toBe(input)
  }
})

test('error extraction preserves ordinary errors and reads a fallback status safely', () => {
  const original = new Error('original')
  expect(toError(original)).toBe(original)
  expect(getErrorMessage(original)).toBe('original')
  expect(getErrorStack(original)).toBe(original.stack)
  const input = Object.defineProperty({ status: 422 }, 'statusCode', { get() { throw new Error('failed status getter') } })
  expect(getErrorStatusCode(input)).toBe(422)
  expect(getErrorCode({ code: 'ENOENT' })).toBe('ENOENT')
})
