/**
 * `schema.file()` — chainable validator for uploaded files
 * (stacksjs/stacks#1856).
 *
 * Mirrors the ergonomics of `schema.string()` / `schema.number()` /
 * `schema.enum()` from ts-validation but targets the `UploadedFile`
 * shape that `req.file('avatar')` / `req.files` return. Conforms to the
 * `{ rule: { validate(value): { valid, errors? } } }` contract that the
 * Action layer ({@link `@stacksjs/router`} → `validateActionInput`)
 * iterates, so file validations slot into the same `validations:` block
 * as the rest of the field rules:
 *
 * @example
 * ```ts
 * new Action({
 *   method: 'POST',
 *   validations: {
 *     avatar: { rule: schema.file().image().maxBytes(2 * 1024 * 1024) },
 *   },
 *   async handle(req) {
 *     const file = req.file('avatar')!
 *     const { url } = await Storage.put(file, { disk: 'public', dir: 'avatars' })
 *     // …
 *   },
 * })
 * ```
 *
 * The validator is intentionally narrow on the input it accepts: a
 * structural shape with `size: number` and either `mimetype` or
 * `mimeType`, optionally with `originalName` / `name`. Both the
 * router's wrapping `UploadedFile` class and the raw multipart-parse
 * shape satisfy it.
 */

/** Shape this validator runs against. */
export interface FileLike {
  size: number
  /** Snake-case mimetype (raw multipart shape). */
  mimetype?: string
  /** Class-style mimetype (router's `UploadedFile`). */
  mimeType?: string
  /** Original filename (raw shape). */
  originalName?: string
  /** Class-style filename (router's `UploadedFile`). */
  name?: string
}

interface ValidationError { message: string }
interface ValidationResult { valid: boolean, errors?: ValidationError[] }

/**
 * Mimetype list used by `.image()`. Intentionally limited to formats
 * the browser actually renders inline — SVG is deliberately omitted
 * because its scripting surface makes it a different validation
 * problem from raster images. Callers who want SVG can opt in via
 * `.mimeTypes(['image/svg+xml', ...])` explicitly.
 */
const IMAGE_MIMETYPES: ReadonlySet<string> = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
  'image/avif',
])

function mimetypeOf(file: FileLike): string | undefined {
  return file.mimetype ?? file.mimeType
}

function originalNameOf(file: FileLike): string | undefined {
  return file.originalName ?? file.name
}

function extensionOf(file: FileLike): string | null {
  const name = originalNameOf(file)
  if (!name) return null
  const idx = name.lastIndexOf('.')
  if (idx <= 0 || idx === name.length - 1) return null
  const ext = name.slice(idx + 1).toLowerCase()
  return /^[a-z0-9]+$/.test(ext) ? ext : null
}

/**
 * Chainable file validator. Each method returns `this` so callers can
 * stack constraints in any order; rules accumulate into an internal
 * list and run sequentially on `.validate()`.
 *
 * Designed to be cheap to construct — most validators in an Action's
 * `validations:` block are built once at module load. No I/O happens
 * here; image dimension / content-sniffing rules belong in a separate
 * `@stacksjs/storage/image` opt-in (deliverable 5 of #1856).
 */
export class FileValidator {
  private _required = false
  private _rules: Array<(file: FileLike) => string | null> = []

  /** Reject `null` / `undefined`. By default an absent file is valid. */
  required(): this {
    this._required = true
    return this
  }

  /**
   * Restrict to common browser-renderable image mimetypes. Equivalent to
   * `.mimeTypes(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/avif'])`.
   */
  image(): this {
    this._rules.push((file) => {
      const mime = mimetypeOf(file)
      if (!mime || !IMAGE_MIMETYPES.has(mime.toLowerCase()))
        return `must be an image (got ${mime || 'no mimetype'})`
      return null
    })
    return this
  }

  /** Explicit mimetype allow-list. Case-insensitive. */
  mimeTypes(allowed: string[]): this {
    const normalized = new Set(allowed.map(m => m.toLowerCase()))
    this._rules.push((file) => {
      const mime = mimetypeOf(file)
      if (!mime || !normalized.has(mime.toLowerCase()))
        return `must be one of: ${allowed.join(', ')} (got ${mime || 'no mimetype'})`
      return null
    })
    return this
  }

  /** Maximum size in bytes. */
  maxBytes(max: number): this {
    this._rules.push((file) => {
      if (typeof file.size !== 'number')
        return 'has no size — cannot enforce maxBytes'
      if (file.size > max)
        return `is too large: ${file.size} bytes exceeds the ${max}-byte cap`
      return null
    })
    return this
  }

  /** Minimum size in bytes. Useful to reject empty uploads. */
  minBytes(min: number): this {
    this._rules.push((file) => {
      if (typeof file.size !== 'number')
        return 'has no size — cannot enforce minBytes'
      if (file.size < min)
        return `is too small: ${file.size} bytes is below the ${min}-byte minimum`
      return null
    })
    return this
  }

  /**
   * Allowed file extensions (derived from `originalName`, lower-cased).
   * Compared against `originalName.split('.').pop()`; mimetype is not
   * consulted here so callers retain control over the spelling rule
   * (`.jpg` vs `.jpeg`, for example).
   */
  extensions(allowed: string[]): this {
    const normalized = new Set(allowed.map(e => e.toLowerCase().replace(/^\./, '')))
    this._rules.push((file) => {
      const ext = extensionOf(file)
      if (!ext || !normalized.has(ext))
        return `must have one of these extensions: ${allowed.join(', ')} (got ${ext ? `.${ext}` : 'no extension'})`
      return null
    })
    return this
  }

  /**
   * Custom predicate. Return `null` for valid; return an error message
   * (or any falsy → `null` for valid) for invalid.
   */
  custom(rule: (file: FileLike) => string | null): this {
    this._rules.push(rule)
    return this
  }

  /**
   * Run all configured rules against a value. Returns the standard
   * `{ valid, errors }` shape the router's `validateActionInput`
   * expects.
   *
   * The router's input merging (stacksjs/stacks#1856) puts
   * `req.allFiles()` into the validation input, so a multipart field
   * named `avatar` shows up here as the `UploadedFile` instance.
   */
  validate(value: unknown): ValidationResult {
    if (value === null || value === undefined) {
      if (this._required)
        return { valid: false, errors: [{ message: 'is required' }] }
      return { valid: true }
    }

    if (typeof value !== 'object' || typeof (value as FileLike).size !== 'number') {
      return { valid: false, errors: [{ message: 'must be an uploaded file' }] }
    }

    const file = value as FileLike
    const errors: ValidationError[] = []
    for (const rule of this._rules) {
      const msg = rule(file)
      if (msg) errors.push({ message: msg })
    }
    return errors.length === 0 ? { valid: true } : { valid: false, errors }
  }
}

/** Factory matching ts-validation's `v.string()` / `v.number()` style. */
export function file(): FileValidator {
  return new FileValidator()
}
