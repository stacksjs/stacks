import { describe, expect, test } from 'bun:test'
import { file, FileValidator, schema } from '../src/schema'

/**
 * `schema.file()` tests (stacksjs/stacks#1856 Phase A).
 *
 * The validator runs against the structural `FileLike` shape — both
 * the router's `UploadedFile` class instances and the older
 * `{ originalName, mimetype, buffer, size }` direct-multipart shape
 * satisfy it. Tests use the structural shape directly so they don't
 * depend on the router being present in the test environment.
 */

function fakeFile(overrides: Partial<{ size: number, mimetype?: string, mimeType?: string, originalName?: string, name?: string }> = {}) {
  return {
    size: 1024,
    mimetype: 'image/jpeg',
    originalName: 'photo.jpg',
    ...overrides,
  }
}

describe('schema.file()', () => {
  test('is exposed on the schema proxy alongside ts-validation methods', () => {
    expect(typeof schema.file).toBe('function')
    expect(schema.file()).toBeInstanceOf(FileValidator)
    // ts-validation's surface is preserved — the proxy doesn't shadow `string()`.
    expect(typeof schema.string).toBe('function')
  })

  test('`file()` is also exported directly for callers that prefer the named import', () => {
    expect(typeof file).toBe('function')
    expect(file()).toBeInstanceOf(FileValidator)
  })
})

describe('FileValidator — required', () => {
  test('passes when the field is absent if not required', () => {
    expect(file().validate(undefined).valid).toBe(true)
    expect(file().validate(null).valid).toBe(true)
  })

  test('rejects null/undefined when `.required()` was called', () => {
    const v = file().required()
    expect(v.validate(undefined).valid).toBe(false)
    expect(v.validate(null).valid).toBe(false)
  })

  test('rejects non-file values', () => {
    const v = file()
    expect(v.validate('not a file').valid).toBe(false)
    expect(v.validate(42).valid).toBe(false)
  })
})

describe('FileValidator — image()', () => {
  test('accepts the common renderable image mimetypes', () => {
    for (const mime of ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif']) {
      expect(file().image().validate(fakeFile({ mimetype: mime })).valid).toBe(true)
    }
  })

  test('rejects non-image mimetypes', () => {
    expect(file().image().validate(fakeFile({ mimetype: 'application/pdf' })).valid).toBe(false)
    expect(file().image().validate(fakeFile({ mimetype: 'text/plain' })).valid).toBe(false)
  })

  test('rejects SVG explicitly — opt-in via `.mimeTypes(...)` instead', () => {
    // SVG's scripting surface makes it a different validation problem
    // from raster images; documented as intentional in the validator.
    expect(file().image().validate(fakeFile({ mimetype: 'image/svg+xml' })).valid).toBe(false)
  })

  test('reads the class-style `mimeType` alias too', () => {
    const fileWithClassShape = { size: 1024, mimeType: 'image/png', name: 'x.png' }
    expect(file().image().validate(fileWithClassShape).valid).toBe(true)
  })
})

describe('FileValidator — size constraints', () => {
  test('maxBytes rejects files over the cap', () => {
    const v = file().maxBytes(1000)
    expect(v.validate(fakeFile({ size: 500 })).valid).toBe(true)
    expect(v.validate(fakeFile({ size: 1000 })).valid).toBe(true)
    expect(v.validate(fakeFile({ size: 1001 })).valid).toBe(false)
  })

  test('minBytes rejects empty / undersized files', () => {
    const v = file().minBytes(100)
    expect(v.validate(fakeFile({ size: 0 })).valid).toBe(false)
    expect(v.validate(fakeFile({ size: 99 })).valid).toBe(false)
    expect(v.validate(fakeFile({ size: 100 })).valid).toBe(true)
  })

  test('error messages cite the offending size', () => {
    const r = file().maxBytes(1000).validate(fakeFile({ size: 5000 }))
    expect(r.valid).toBe(false)
    expect(r.errors?.[0]?.message).toContain('5000')
    expect(r.errors?.[0]?.message).toContain('1000')
  })
})

describe('FileValidator — extensions', () => {
  test('matches the original filename extension, case-insensitive', () => {
    const v = file().extensions(['jpg', 'jpeg', 'png'])
    expect(v.validate(fakeFile({ originalName: 'photo.JPG' })).valid).toBe(true)
    expect(v.validate(fakeFile({ originalName: 'photo.png' })).valid).toBe(true)
    expect(v.validate(fakeFile({ originalName: 'doc.pdf' })).valid).toBe(false)
  })

  test('rejects when there is no extension on the original name', () => {
    expect(file().extensions(['jpg']).validate(fakeFile({ originalName: 'noext' })).valid).toBe(false)
  })

  test('strips leading dots — `.jpg` and `jpg` are equivalent', () => {
    const v = file().extensions(['.jpg'])
    expect(v.validate(fakeFile({ originalName: 'photo.jpg' })).valid).toBe(true)
  })
})

describe('FileValidator — mimeTypes', () => {
  test('explicit allow-list, case-insensitive', () => {
    const v = file().mimeTypes(['image/jpeg', 'IMAGE/PNG'])
    expect(v.validate(fakeFile({ mimetype: 'image/jpeg' })).valid).toBe(true)
    expect(v.validate(fakeFile({ mimetype: 'image/png' })).valid).toBe(true)
    expect(v.validate(fakeFile({ mimetype: 'image/webp' })).valid).toBe(false)
  })
})

describe('FileValidator — chaining + accumulated errors', () => {
  test('reports every failing rule, not just the first', () => {
    const v = file().image().maxBytes(100).extensions(['jpg'])
    const r = v.validate(fakeFile({
      mimetype: 'application/pdf',
      size: 5000,
      originalName: 'big.pdf',
    }))
    expect(r.valid).toBe(false)
    expect(r.errors?.length).toBeGreaterThanOrEqual(3)
  })

  test('custom predicate slots in alongside built-in rules', () => {
    const v = file().custom(f => f.size === 1234 ? null : 'size must be exactly 1234')
    expect(v.validate(fakeFile({ size: 1234 })).valid).toBe(true)
    const r = v.validate(fakeFile({ size: 1233 }))
    expect(r.valid).toBe(false)
    expect(r.errors?.[0]?.message).toContain('1234')
  })
})

describe('FileValidator — action contract', () => {
  test('matches the shape `validateActionInput` expects', () => {
    // The Action layer iterates `{ rule: { validate(value): { valid, errors? } } }`.
    // A new validator must satisfy that contract — this test guards against an
    // accidental rename.
    const v = file().required().image()
    const r = v.validate({ size: 100, mimetype: 'application/pdf' })
    expect(r).toHaveProperty('valid')
    expect(r.valid).toBe(false)
    expect(Array.isArray(r.errors)).toBe(true)
    expect(typeof r.errors?.[0]?.message).toBe('string')
  })
})
