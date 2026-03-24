import { describe, expect, it } from 'bun:test'
import { slugify } from '../../strings/src/slug'

describe('slugify', () => {
  it('should convert basic text to slug', () => {
    expect(slugify('Hello World')).toBe('Hello-World')
  })

  it('should convert to lowercase when option is set', () => {
    expect(slugify('Hello World', { lower: true })).toBe('hello-world')
  })

  it('should handle custom separator', () => {
    expect(slugify('Hello World', { replacement: '_' })).toBe('Hello_World')
  })

  it('should handle multiple spaces', () => {
    expect(slugify('Hello   World')).toBe('Hello-World')
  })

  it('should handle leading and trailing spaces', () => {
    expect(slugify('  Hello World  ')).toBe('Hello-World')
  })

  it('should not trim when trim is false', () => {
    expect(slugify('  Hello World  ', { trim: false })).toBe('-Hello-World-')
  })

  it('should convert unicode characters', () => {
    expect(slugify('bon appetit')).toBe('bon-appetit')
  })

  it('should handle accented characters', () => {
    const result = slugify('cafe avec creme brulee', { lower: true })
    expect(result).toBe('cafe-avec-creme-brulee')
  })

  it('should handle German umlauts', () => {
    expect(slugify('Uber Strasse', { lower: true })).toBe('uber-strasse')
  })

  it('should handle strict mode removing non-alphanumeric', () => {
    expect(slugify('Hello, World!', { strict: true })).toBe('Hello-World')
  })

  it('should throw on non-string input', () => {
    // eslint-disable-next-line ts/no-unsafe-argument
    expect(() => slugify(123 as any)).toThrow(TypeError)
  })

  it('should handle empty string', () => {
    expect(slugify('')).toBe('')
  })

  it('should handle string with only spaces', () => {
    expect(slugify('   ')).toBe('')
  })

  it('should handle currency symbols', () => {
    const result = slugify('Price is $100')
    expect(result).toContain('dollar')
  })

  it('should handle already slugified text', () => {
    expect(slugify('hello-world')).toBe('hello-world')
  })

  it('should handle consecutive dashes in input', () => {
    expect(slugify('hello---world')).toBe('hello-world')
  })

  it('should handle numbers in text', () => {
    expect(slugify('version 2 release', { lower: true })).toBe('version-2-release')
  })
})
