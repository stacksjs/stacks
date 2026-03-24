import { describe, expect, it } from 'bun:test'
import { ok, err, fromPromise } from 'ts-error-handling'

describe('Result type - ok()', () => {
  it('ok(value).isOk is true', () => {
    const result = ok(42)
    expect(result.isOk).toBe(true)
  })

  it('ok(value).isErr is false', () => {
    const result = ok(42)
    expect(result.isErr).toBe(false)
  })

  it('ok(value).value returns the wrapped value', () => {
    const result = ok('hello')
    expect(result.value).toBe('hello')
  })

  it('ok(value).unwrap() returns the value', () => {
    const result = ok(100)
    expect(result.unwrap()).toBe(100)
  })

  it('ok(value).unwrapOr() returns the value, not the default', () => {
    const result = ok(10)
    expect(result.unwrapOr(99)).toBe(10)
  })

  it('ok(value).map() transforms the value', () => {
    const result = ok(5).map(v => v * 2)
    expect(result.isOk).toBe(true)
    expect(result.unwrap()).toBe(10)
  })

  it('ok(value).andThen() chains to another Result', () => {
    const result = ok(5).andThen(v => ok(v + 1))
    expect(result.isOk).toBe(true)
    expect(result.unwrap()).toBe(6)
  })

  it('ok(value).match() calls the ok branch', () => {
    const output = ok(42).match({
      ok: v => `value is ${v}`,
      err: () => 'error',
    })
    expect(output).toBe('value is 42')
  })
})

describe('Result type - err()', () => {
  it('err(error).isErr is true', () => {
    const result = err('something went wrong')
    expect(result.isErr).toBe(true)
  })

  it('err(error).isOk is false', () => {
    const result = err('fail')
    expect(result.isOk).toBe(false)
  })

  it('err(error).error returns the error value', () => {
    const result = err('bad input')
    expect(result.error).toBe('bad input')
  })

  it('err(error).unwrap() throws', () => {
    const result = err('failure')
    expect(() => result.unwrap()).toThrow()
  })

  it('err(error).unwrapOr() returns the default value', () => {
    const result = err<number, string>('failure')
    expect(result.unwrapOr(42)).toBe(42)
  })

  it('err(error).map() does not transform', () => {
    const result = err<number, string>('fail').map(v => v * 2)
    expect(result.isErr).toBe(true)
    expect(result.error).toBe('fail')
  })

  it('err(error).mapErr() transforms the error', () => {
    const result = err<number, string>('fail').mapErr(e => `wrapped: ${e}`)
    expect(result.isErr).toBe(true)
    expect(result.error).toBe('wrapped: fail')
  })

  it('err(error).match() calls the err branch', () => {
    const output = err('oops').match({
      ok: () => 'ok',
      err: e => `error: ${e}`,
    })
    expect(output).toBe('error: oops')
  })
})

describe('Result type - fromPromise()', () => {
  it('wraps a resolved promise into ok', async () => {
    const result = await fromPromise(Promise.resolve(42))
    expect(result.isOk).toBe(true)
    expect(result.unwrap()).toBe(42)
  })

  it('wraps a rejected promise into err', async () => {
    const result = await fromPromise(Promise.reject(new Error('async fail')))
    expect(result.isErr).toBe(true)
  })

  it('applies a custom error handler on rejection', async () => {
    const result = await fromPromise(
      Promise.reject(new Error('boom')),
      (e) => `caught: ${(e as Error).message}`,
    )
    expect(result.isErr).toBe(true)
    expect(result.error).toBe('caught: boom')
  })
})
