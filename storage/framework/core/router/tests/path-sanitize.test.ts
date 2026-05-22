import { describe, expect, test } from 'bun:test'
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
})
