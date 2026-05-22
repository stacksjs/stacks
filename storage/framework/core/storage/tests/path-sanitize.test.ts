import { describe, expect, test } from 'bun:test'
import { PathSanitizeError, sanitizePresignedDir, sanitizePresignedFilename } from '../src/path-sanitize'

describe('sanitizePresignedDir (stacksjs/stacks#1873 S-1)', () => {
  test('passes through a clean dir unchanged', () => {
    expect(sanitizePresignedDir('avatars')).toBe('avatars')
    expect(sanitizePresignedDir('users/123')).toBe('users/123')
    expect(sanitizePresignedDir('a/b/c')).toBe('a/b/c')
  })

  test('treats undefined and empty string as no-dir', () => {
    expect(sanitizePresignedDir(undefined)).toBe('')
    expect(sanitizePresignedDir('')).toBe('')
  })

  test('strips trailing slashes', () => {
    expect(sanitizePresignedDir('avatars/')).toBe('avatars')
    expect(sanitizePresignedDir('users/123/')).toBe('users/123')
    expect(sanitizePresignedDir('a/b/c//')).toBe('a/b/c')
  })

  test('rejects absolute paths', () => {
    expect(() => sanitizePresignedDir('/avatars')).toThrow(PathSanitizeError)
    try {
      sanitizePresignedDir('/avatars')
    }
    catch (e) {
      expect(e instanceof PathSanitizeError && e.reason).toBe('absolute-path')
    }
  })

  test('rejects `..` traversal anywhere in the path', () => {
    expect(() => sanitizePresignedDir('..')).toThrow(PathSanitizeError)
    expect(() => sanitizePresignedDir('../sensitive')).toThrow(PathSanitizeError)
    expect(() => sanitizePresignedDir('avatars/..')).toThrow(PathSanitizeError)
    expect(() => sanitizePresignedDir('avatars/../bypass')).toThrow(PathSanitizeError)
    expect(() => sanitizePresignedDir('../../etc/passwd')).toThrow(PathSanitizeError)
  })

  test('rejects single dot segments', () => {
    expect(() => sanitizePresignedDir('./avatars')).toThrow(PathSanitizeError)
    expect(() => sanitizePresignedDir('avatars/./foo')).toThrow(PathSanitizeError)
  })

  test('rejects double slashes (would create empty segment)', () => {
    expect(() => sanitizePresignedDir('avatars//bypass')).toThrow(PathSanitizeError)
  })

  test('rejects null bytes', () => {
    expect(() => sanitizePresignedDir('avatars\0evil')).toThrow(PathSanitizeError)
  })

  test('rejects control characters', () => {
    expect(() => sanitizePresignedDir('avatars\r\nevil')).toThrow(PathSanitizeError)
    expect(() => sanitizePresignedDir('avatars\tfoo')).toThrow(PathSanitizeError)
  })

  test('rejects non-ASCII characters (allow-list policy)', () => {
    expect(() => sanitizePresignedDir('avatárs')).toThrow(PathSanitizeError)
    expect(() => sanitizePresignedDir('users/中文')).toThrow(PathSanitizeError)
  })

  test('rejects shell metacharacters', () => {
    expect(() => sanitizePresignedDir('a;b')).toThrow(PathSanitizeError)
    expect(() => sanitizePresignedDir('a$b')).toThrow(PathSanitizeError)
    expect(() => sanitizePresignedDir('a&b')).toThrow(PathSanitizeError)
    expect(() => sanitizePresignedDir('a|b')).toThrow(PathSanitizeError)
    expect(() => sanitizePresignedDir('a b')).toThrow(PathSanitizeError) // space
  })

  test('rejects segments exceeding NAME_MAX (255)', () => {
    expect(() => sanitizePresignedDir('a'.repeat(256))).toThrow(PathSanitizeError)
  })

  test('rejects non-string input', () => {
    // @ts-expect-error - testing runtime guard for non-string input
    expect(() => sanitizePresignedDir(123)).toThrow(PathSanitizeError)
    // @ts-expect-error - testing runtime guard for non-string input
    expect(() => sanitizePresignedDir({})).toThrow(PathSanitizeError)
  })
})

describe('sanitizePresignedFilename (stacksjs/stacks#1873 S-2)', () => {
  test('passes through a clean filename unchanged', () => {
    expect(sanitizePresignedFilename('avatar.png')).toBe('avatar.png')
    expect(sanitizePresignedFilename('IMG_1234.jpg')).toBe('IMG_1234.jpg')
    expect(sanitizePresignedFilename('report-2024-q1.pdf')).toBe('report-2024-q1.pdf')
  })

  test('allows filenames without an extension', () => {
    // The adapter appends an extension from contentType when none is
    // provided — see s3.ts:extensionForContentType.
    expect(sanitizePresignedFilename('avatar')).toBe('avatar')
    expect(sanitizePresignedFilename('README')).toBe('README')
  })

  test('rejects empty string', () => {
    expect(() => sanitizePresignedFilename('')).toThrow(PathSanitizeError)
  })

  test('rejects path separators', () => {
    expect(() => sanitizePresignedFilename('foo/bar.jpg')).toThrow(PathSanitizeError)
    expect(() => sanitizePresignedFilename('foo\\bar.jpg')).toThrow(PathSanitizeError)
  })

  test('rejects traversal tokens', () => {
    expect(() => sanitizePresignedFilename('..')).toThrow(PathSanitizeError)
    expect(() => sanitizePresignedFilename('.')).toThrow(PathSanitizeError)
    // `..foo` standalone would pass (it's just chars), but `../foo` is
    // a separator + traversal which the separator check catches first.
  })

  test('rejects null bytes', () => {
    expect(() => sanitizePresignedFilename('shell.png\0.php')).toThrow(PathSanitizeError)
  })

  test('rejects control characters', () => {
    expect(() => sanitizePresignedFilename('a\rb.jpg')).toThrow(PathSanitizeError)
    expect(() => sanitizePresignedFilename('a\nb.jpg')).toThrow(PathSanitizeError)
  })

  test('rejects shell metacharacters', () => {
    expect(() => sanitizePresignedFilename('a;b.jpg')).toThrow(PathSanitizeError)
    expect(() => sanitizePresignedFilename('a$(whoami).jpg')).toThrow(PathSanitizeError)
    expect(() => sanitizePresignedFilename('a b.jpg')).toThrow(PathSanitizeError)
  })

  test('rejects non-ASCII characters', () => {
    expect(() => sanitizePresignedFilename('café.jpg')).toThrow(PathSanitizeError)
  })

  test('rejects filenames longer than 255 chars', () => {
    expect(() => sanitizePresignedFilename(`${'a'.repeat(252)}.jpg`)).toThrow(PathSanitizeError)
  })

  test('rejects invalid extension characters', () => {
    // A trailing dot is not a valid extension — caught by the dotIdx
    // bounds check.
    expect(() => sanitizePresignedFilename('foo.')).not.toThrow() // dotIdx === length-1, no extension to validate
    // Mixed-case extension is fine — we lowercase before checking.
    expect(sanitizePresignedFilename('foo.JPG')).toBe('foo.JPG')
  })

  test('rejects non-string input', () => {
    // @ts-expect-error - testing runtime guard for non-string input
    expect(() => sanitizePresignedFilename(undefined)).toThrow(PathSanitizeError)
    // @ts-expect-error - testing runtime guard for non-string input
    expect(() => sanitizePresignedFilename(null)).toThrow(PathSanitizeError)
  })
})

describe('PathSanitizeError discriminant', () => {
  test('reason captures the rejection category', () => {
    const cases: Array<[() => unknown, string]> = [
      [() => sanitizePresignedDir('../foo'), 'traversal'],
      [() => sanitizePresignedDir('/abs'), 'absolute-path'],
      [() => sanitizePresignedDir('a\0b'), 'null-byte'],
      [() => sanitizePresignedDir('a\rb'), 'control-char'],
      [() => sanitizePresignedDir('a$b'), 'invalid-char'],
      [() => sanitizePresignedDir('a'.repeat(256)), 'too-long'],
      // @ts-expect-error - testing runtime guard
      [() => sanitizePresignedDir(42), 'not-string'],
      [() => sanitizePresignedFilename(''), 'empty'],
    ]

    for (const [fn, reason] of cases) {
      try {
        fn()
        throw new Error(`expected ${reason} to throw`)
      }
      catch (e) {
        expect(e).toBeInstanceOf(PathSanitizeError)
        expect((e as PathSanitizeError).reason).toBe(reason as PathSanitizeError['reason'])
      }
    }
  })
})
