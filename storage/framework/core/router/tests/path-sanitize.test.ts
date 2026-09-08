import { describe, expect, test } from 'bun:test'
import type { PathParamRejection, SanitizePathParamOptions } from '../src/path-sanitize'
import { PathParamError, safePathParam, sanitizePathParam } from '../src/path-sanitize'

// Regression coverage for stacksjs/stacks#1870 R-12.

describe('sanitizePathParam', () => {
  test('accepts a plain filename', () => {
    expect(sanitizePathParam('avatar.png')).toBe('avatar.png')
  })

  test('rejects ../ traversal (POSIX separator)', () => {
    expect(() => sanitizePathParam('../etc/passwd')).toThrow(PathParamError)
  })

  test('rejects ..\\ traversal (Windows separator)', () => {
    expect(() => sanitizePathParam('..\\windows\\system32')).toThrow(PathParamError)
  })

  test('rejects absolute paths', () => {
    expect(() => sanitizePathParam('/etc/passwd')).toThrow(PathParamError)
    expect(() => sanitizePathParam('C:\\Windows')).toThrow(PathParamError)
  })

  test('rejects embedded null bytes', () => {
    expect(() => sanitizePathParam('avatar.png\0.exe')).toThrow(PathParamError)
  })

  test('rejects ASCII control characters', () => {
    expect(() => sanitizePathParam('avatar.png')).toThrow(PathParamError)
  })

  test('rejects values over maxLength', () => {
    const long = 'a'.repeat(300)
    expect(() => sanitizePathParam(long)).toThrow(PathParamError)
  })

  test('rejects non-string', () => {
    expect(() => sanitizePathParam(42)).toThrow(PathParamError)
    expect(() => sanitizePathParam(undefined)).toThrow(PathParamError)
  })

  test('allowSlashes lets multi-segment paths through but still blocks ..', () => {
    expect(sanitizePathParam('users/42/avatar.png', { allowSlashes: true })).toBe('users/42/avatar.png')
    expect(() => sanitizePathParam('users/../etc/passwd', { allowSlashes: true })).toThrow(PathParamError)
  })

  test('safePathParam returns null on rejection', () => {
    expect(safePathParam('../escape')).toBe(null)
    expect(safePathParam('avatar.png')).toBe('avatar.png')
  })

  test('allows filenames that start with two dots (not a traversal segment)', () => {
    // `..hidden` is a single segment that begins with two dots — not a
    // traversal. The traversal regex anchors on `..` as a SEGMENT.
    expect(sanitizePathParam('..hidden')).toBe('..hidden')
  })

  test('PathParamError exposes the reason for branchable handling', () => {
    try {
      sanitizePathParam('../x')
    }
    catch (err) {
      expect(err).toBeInstanceOf(PathParamError)
      expect((err as PathParamError).reason).toBe('traversal')
      return
    }
    throw new Error('expected PathParamError to be thrown')
  })

  const rejected: [unknown, PathParamRejection, SanitizePathParamOptions?][] = [
    [undefined, 'not-string'],
    [null, 'not-string'],
    [42, 'not-string'],
    ['', 'empty', { maxLength: -1 }],
    ['a'.repeat(256), 'too-long'],
    ['/\0', 'too-long', { maxLength: 1 }],
    ['/\0', 'null-byte'],
    ['/\n', 'control-char'],
    ['/../file', 'absolute-path'],
    ['C:\\..\\file', 'absolute-path'],
    ['c:/file', 'absolute-path'],
    ['..', 'traversal'],
    ['a/../file', 'traversal', { allowSlashes: true }],
    ['a\\..\\file', 'traversal', { allowSlashes: true }],
    ['a/..\\file', 'traversal', { allowSlashes: true }],
    ['a/b', 'traversal'],
    ['a\\b', 'traversal'],
  ]

  test.each(rejected.map(([value, reason, options]) => ({ value, reason, options })))('preserves rejection reason and context for %j', ({ value, reason, options }) => {
    expect(safePathParam(value, options)).toBeNull()
    try {
      sanitizePathParam(value, { ...options, context: 'avatar download' })
    }
    catch (error) {
      expect(error).toBeInstanceOf(PathParamError)
      expect((error as PathParamError).reason).toBe(reason)
      expect((error as PathParamError).message).toBe(`[router] Refusing to use ${JSON.stringify(value)} as a path parameter in avatar download - ${reason}`)
      return
    }
    throw new Error('expected a rejected path parameter')
  })

  test('both helpers accept boundary lengths and non-traversal dot segments', () => {
    for (const value of ['a', '.', '..hidden', 'a..', 'a'.repeat(255), '头像.png']) {
      expect(safePathParam(value)).toBe(value)
      expect(sanitizePathParam(value)).toBe(value)
    }
    for (const value of ['a/..hidden/b', 'a\\..hidden\\b']) {
      expect(safePathParam(value, { allowSlashes: true })).toBe(value)
      expect(sanitizePathParam(value, { allowSlashes: true })).toBe(value)
    }
    expect(safePathParam('abc', { maxLength: 3 })).toBe('abc')
    expect(safePathParam('abcd', { maxLength: 3 })).toBeNull()
  })

  test('every ASCII control character is rejected', () => {
    for (const code of [...Array.from({ length: 32 }, (_, index) => index), 127]) {
      const value = `a${String.fromCharCode(code)}b`
      expect(safePathParam(value)).toBeNull()
      expect(() => sanitizePathParam(value)).toThrow(PathParamError)
    }
  })

  test('the non-throwing helper contains option accessor failures', () => {
    const failure = new Error('unavailable option')
    for (const property of ['maxLength', 'allowSlashes']) {
      const options = Object.defineProperty({}, property, { get() { throw failure } })
      expect(safePathParam('avatar.png', options)).toBeNull()
      expect(() => sanitizePathParam('avatar.png', options)).toThrow(failure)
    }
  })

  test('the non-throwing helper rejects values that cannot be JSON serialized', () => {
    const circular: { self?: unknown } = {}
    circular.self = circular
    for (const value of [1n, circular, { toJSON() { throw new Error('cannot serialize') } }]) {
      expect(safePathParam(value)).toBeNull()
    }
  })
})
