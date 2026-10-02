import type { RequestInstance } from '@stacksjs/types'
import { describe, expect, test } from 'bun:test'
import { commerceIdentifier, commerceMinorAmountError, commerceNotFound } from './commerce-action'

function request(id: string): RequestInstance {
  return {
    getParam: () => id,
  } as unknown as RequestInstance
}

describe('commerce action responses', () => {
  test('accepts safe positive route identifiers', () => {
    expect(commerceIdentifier(request('42'), 'Courier')).toEqual({ id: 42 })
  })

  test('returns 422 for invalid identifiers', async () => {
    const result = commerceIdentifier(request('not-an-id'), 'Courier')
    expect(result.error?.status).toBe(422)
    expect(await result.error?.json()).toEqual({
      message: 'Courier id must be a positive integer.',
    })
  })

  test('returns a consistent not-found response', async () => {
    const result = commerceNotFound('Courier', 42)
    expect(result.status).toBe(404)
    expect(await result.json()).toEqual({
      message: 'Courier 42 was not found.',
    })
  })
})

function body(fields: Record<string, unknown>): RequestInstance {
  return {
    get: (name: string) => fields[name],
  } as unknown as RequestInstance
}

describe('commerce minor-unit amounts (stacksjs/stacks#2851)', () => {
  test('accepts an integer number of minor units', () => {
    expect(commerceMinorAmountError(body({ price: 1999 }), 'price', 'Price', { required: true, min: 1 })).toBeUndefined()
    expect(commerceMinorAmountError(body({ price: '1999' }), 'price', 'Price', { required: true, min: 1 })).toBeUndefined()
  })

  test('rejects a decimal, which would be stored as a fraction of a cent', async () => {
    const result = commerceMinorAmountError(body({ price: 19.99 }), 'price', 'Price', { required: true, min: 1 })
    expect(result?.status).toBe(422)
    expect(await result?.json()).toEqual({
      message: 'Price must be a whole number of minor units, for example 1999 for 19.99.',
      errors: { price: ['Price must be a whole number of minor units, for example 1999 for 19.99.'] },
    })
    expect(commerceMinorAmountError(body({ price: '19.99' }), 'price', 'Price')?.status).toBe(422)
  })

  test('enforces the minimum and presence only when asked', () => {
    expect(commerceMinorAmountError(body({ price: 0 }), 'price', 'Price', { min: 1 })?.status).toBe(422)
    expect(commerceMinorAmountError(body({}), 'price', 'Price', { required: true })?.status).toBe(422)
    expect(commerceMinorAmountError(body({}), 'price', 'Price')).toBeUndefined()
  })
})
