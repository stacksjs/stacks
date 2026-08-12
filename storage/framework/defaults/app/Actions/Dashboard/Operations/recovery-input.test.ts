import { describe, expect, it } from 'bun:test'
import { jsonObject, positiveNumber, stringList, stringValue } from './recovery-input'

describe('recovery input normalization', () => {
  it('normalizes scalar and list input without accepting nested values', () => {
    expect(stringValue('  backups  ')).toBe('backups')
    expect(stringValue({ value: 'backups' })).toBe('')
    expect(stringList('storage/app, public/uploads, ')).toEqual(['storage/app', 'public/uploads'])
    expect(stringList([' storage/app ', null, 'public/uploads'])).toEqual(['storage/app', 'public/uploads'])
  })

  it('bounds positive recovery objectives and retention values', () => {
    expect(positiveNumber('30', 7, 100)).toBe(30)
    expect(positiveNumber(500, 7, 100)).toBe(100)
    expect(positiveNumber(0, 7, 100)).toBe(7)
  })

  it('accepts only record-shaped restore metadata', () => {
    expect(jsonObject({ engine: 'postgres' })).toEqual({ engine: 'postgres' })
    expect(jsonObject(['postgres'])).toEqual({})
  })
})
