import { describe, expect, it } from 'bun:test'
import { compareBytes, formatBytes, parseBytes, prettyBytes, readableSize } from '../src/bytes'

describe('formatBytes', () => {
  it('should format bytes to KB', () => {
    expect(formatBytes(1000)).toBe('1 KB')
    expect(formatBytes(1024)).toBe('1 KB')
  })

  it('should format bytes to MB', () => {
    expect(formatBytes(1000000)).toBe('1 MB')
    expect(formatBytes(1500000)).toBe('1.5 MB')
  })

  it('should format bytes to GB', () => {
    expect(formatBytes(1000000000)).toBe('1 GB')
    expect(formatBytes(2500000000)).toBe('2.5 GB')
  })

  it('should handle binary units', () => {
    expect(formatBytes(1024, { binary: true })).toBe('1 KiB')
    expect(formatBytes(1048576, { binary: true })).toBe('1 MiB')
  })

  it('should respect precision option', () => {
    expect(formatBytes(1234567, { precision: 2 })).toBe('1.23 MB')
    expect(formatBytes(1234567, { precision: 3 })).toBe('1.235 MB')
  })

  it('should handle negative bytes', () => {
    expect(formatBytes(-1000)).toBe('-1 KB')
    expect(formatBytes(-1500000)).toBe('-1.5 MB')
  })

  it('should handle zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B')
  })

  it('should handle bytes less than 1', () => {
    expect(formatBytes(0.5)).toBe('0.5 B')
  })

  it('should handle space option', () => {
    expect(formatBytes(1000, { space: false })).toBe('1KB')
  })

  it('should handle locale option', () => {
    expect(formatBytes(1234567, { locale: 'de-DE', precision: 2 })).toBe('1,23 MB')
  })

  it('should throw on non-finite numbers', () => {
    expect(() => formatBytes(Number.POSITIVE_INFINITY)).toThrow()
    expect(() => formatBytes(Number.NaN)).toThrow()
  })

  it('should handle very large numbers', () => {
    expect(formatBytes(1e24)).toBe('1 YB')
  })
})

describe('parseBytes', () => {
  it('should parse KB to bytes', () => {
    expect(parseBytes('1 KB')).toBe(1000)
    expect(parseBytes('1.5 KB')).toBe(1500)
  })

  it('should parse MB to bytes', () => {
    expect(parseBytes('1 MB')).toBe(1000000)
    expect(parseBytes('2.5 MB')).toBe(2500000)
  })

  it('should parse binary units', () => {
    expect(parseBytes('1 KiB')).toBe(1024)
    expect(parseBytes('1 MiB')).toBe(1048576)
  })

  it('should handle no unit (assumes bytes)', () => {
    expect(parseBytes('100')).toBe(100)
  })

  it('should be case insensitive', () => {
    expect(parseBytes('1 kb')).toBe(1000)
    expect(parseBytes('1 MB')).toBe(1000000)
  })

  it('should handle negative numbers', () => {
    expect(parseBytes('-1 KB')).toBe(-1000)
  })

  it('should handle no space between number and unit', () => {
    expect(parseBytes('1KB')).toBe(1000)
    expect(parseBytes('5MB')).toBe(5000000)
  })

  it('should throw on invalid input', () => {
    expect(() => parseBytes('invalid')).toThrow()
    expect(() => parseBytes('NaN KB')).toThrow()
  })

  it('should handle decimal precision', () => {
    expect(parseBytes('1.234 MB')).toBe(1234000)
  })
})

describe('compareBytes', () => {
  it('should compare byte values', () => {
    expect(compareBytes(1000, 500)).toBeGreaterThan(0)
    expect(compareBytes(500, 1000)).toBeLessThan(0)
    expect(compareBytes(1000, 1000)).toBe(0)
  })

  it('should compare string byte values', () => {
    expect(compareBytes('1 MB', '500 KB')).toBeGreaterThan(0)
    expect(compareBytes('500 KB', '1 MB')).toBeLessThan(0)
  })

  it('should compare mixed types', () => {
    expect(compareBytes(1000000, '1 MB')).toBe(0)
    expect(compareBytes('1 KB', 1000)).toBe(0)
  })
})

describe('aliases', () => {
  it('should export prettyBytes alias', () => {
    expect(prettyBytes).toBe(formatBytes)
  })

  it('should export readableSize alias', () => {
    expect(readableSize).toBe(formatBytes)
  })
})
