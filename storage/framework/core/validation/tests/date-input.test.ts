import { describe, expect, test } from 'bun:test'
import { schema } from '../src'

describe('schema.date()', () => {
  test('accepts Date objects and native date input strings', () => {
    const validator = schema.date()

    expect(validator.validate(new Date('2026-07-30T12:00:00.000Z')).valid).toBe(true)
    expect(validator.validate('2026-07-30' as unknown as Date).valid).toBe(true)
  })

  test('rejects normalized and non-calendar strings', () => {
    const validator = schema.date()

    expect(validator.validate('2026-02-30' as unknown as Date).valid).toBe(false)
    expect(validator.validate('2026-07-30T12:00:00.000Z' as unknown as Date).valid).toBe(false)
    expect(validator.validate('not-a-date' as unknown as Date).valid).toBe(false)
  })
})
