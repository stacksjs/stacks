import { describe, expect, test } from 'bun:test'
import {
  compactSql,
  countValue,
  filesystemUsage,
  finiteNumber,
  percent,
  safeRequestPath,
  summarizeStatuses,
} from './insights-dashboard'

describe('dashboard insight normalization', () => {
  test('normalizes database values without leaking invalid numbers', () => {
    expect(finiteNumber('12.5')).toBe(12.5)
    expect(finiteNumber(Number.NaN)).toBe(0)
    expect(countValue('-3')).toBe(0)
    expect(countValue('8.9')).toBe(8)
  })

  test('keeps percentages bounded and handles empty samples', () => {
    expect(percent(19, 50)).toBe(38)
    expect(percent(4, 0)).toBe(0)
    expect(percent(7, 2)).toBe(100)
  })

  test('groups status rows from portable aggregate results', () => {
    expect(summarizeStatuses([
      { status: 'completed', count: '12' },
      { status: 'slow', count: 2 },
      { status: null, count: 99 },
    ])).toEqual({ completed: 12, slow: 2 })
  })

  test('redacts request query strings and compacts query text', () => {
    expect(safeRequestPath('/callback?token=secret')).toBe('/callback')
    expect(compactSql(' SELECT  *\n FROM users ', 18)).toBe('SELECT * FROM use…')
  })

  test('derives filesystem usage from statfs blocks', () => {
    expect(filesystemUsage(4096, 100, 25)).toEqual({
      totalBytes: 409600,
      availableBytes: 102400,
      usedBytes: 307200,
      usedPercent: 75,
    })
  })
})
