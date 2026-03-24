import { describe, expect, test } from 'bun:test'
import { slugify } from '@stacksjs/strings'

// ---------------------------------------------------------------------------
// Basic slugification
// ---------------------------------------------------------------------------
describe('slugify basic usage', () => {
  test('converts "Hello World" to "Hello-World" by default (case preserved)', () => {
    const result = slugify('Hello World')
    expect(result).toBe('Hello-World')
  })

  test('with lower option converts to lowercase', () => {
    const result = slugify('Hello World', { lower: true })
    expect(result).toBe('hello-world')
  })

  test('preserves numbers', () => {
    const result = slugify('version 2.0', { lower: true })
    expect(result).toBe('version-2.0')
  })

  test('handles multiple spaces', () => {
    const result = slugify('too   many   spaces', { lower: true })
    expect(result).toBe('too-many-spaces')
  })

  test('handles leading and trailing spaces', () => {
    const result = slugify('  padded  ', { lower: true })
    expect(result).toBe('padded')
  })
})

// ---------------------------------------------------------------------------
// Special characters
// ---------------------------------------------------------------------------
describe('slugify with special characters', () => {
  test('replaces & with and', () => {
    const result = slugify('salt & pepper', { lower: true })
    expect(result).toBe('salt-and-pepper')
  })

  test('replaces $ with dollar', () => {
    const result = slugify('price $100', { lower: true })
    expect(result).toBe('price-dollar100')
  })
})

// ---------------------------------------------------------------------------
// Unicode / accented characters
// ---------------------------------------------------------------------------
describe('slugify with unicode', () => {
  test('converts accented characters', () => {
    const result = slugify('cafe', { lower: true })
    expect(result).toBe('cafe')
  })

  test('converts German umlauts', () => {
    const result = slugify('Über cool', { lower: true })
    expect(result).toBe('uber-cool')
  })

  test('converts French accents', () => {
    const result = slugify('creme brulee', { lower: true })
    expect(result).toBe('creme-brulee')
  })
})

// ---------------------------------------------------------------------------
// Strict mode
// ---------------------------------------------------------------------------
describe('slugify strict mode', () => {
  test('strict mode removes non-alphanumeric characters', () => {
    const result = slugify('hello! @world#', { lower: true, strict: true })
    expect(result).toBe('hello-world')
  })

  test('strict mode handles dots and special chars', () => {
    const result = slugify('file.name.txt', { lower: true, strict: true })
    expect(result).toBe('filenametxt')
  })
})

// ---------------------------------------------------------------------------
// Custom replacement
// ---------------------------------------------------------------------------
describe('slugify custom replacement', () => {
  test('uses underscore as replacement', () => {
    const result = slugify('hello world', { replacement: '_', lower: true })
    expect(result).toBe('hello_world')
  })
})

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
describe('slugify edge cases', () => {
  test('empty string returns empty string', () => {
    const result = slugify('')
    expect(result).toBe('')
  })

  test('single character', () => {
    const result = slugify('a')
    expect(result).toBe('a')
  })

  test('already a slug', () => {
    const result = slugify('already-a-slug', { lower: true })
    expect(result).toBe('already-a-slug')
  })

  test('throws for non-string input', () => {
    expect(() => slugify(123 as any)).toThrow()
  })
})
