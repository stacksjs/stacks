import type { RequestInstance } from '@stacksjs/types'
import { describe, expect, test } from 'bun:test'
import { commerceIdentifier, commerceNotFound } from './commerce-action'

function request(id: string): RequestInstance {
  return {
    getParam: () => id,
  } as unknown as RequestInstance
}

describe('commerce action responses', () => {
  test('accepts safe positive route identifiers', () => {
    expect(commerceIdentifier(request('42'), 'Driver')).toEqual({ id: 42 })
  })

  test('returns 422 for invalid identifiers', async () => {
    const result = commerceIdentifier(request('not-an-id'), 'Driver')
    expect(result.error?.status).toBe(422)
    expect(await result.error?.json()).toEqual({
      message: 'Driver id must be a positive integer.',
    })
  })

  test('returns a consistent not-found response', async () => {
    const result = commerceNotFound('Driver', 42)
    expect(result.status).toBe(404)
    expect(await result.json()).toEqual({
      message: 'Driver 42 was not found.',
    })
  })
})
