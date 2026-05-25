/**
 * Path-sanitization helpers for storage adapters (stacksjs/stacks#1873).
 *
 * Callers of `presignedUploadUrl({ dir, filename })` pass in
 * caller-controlled strings that get interpolated straight into the
 * stored key. Without sanitization, `dir: '../../sensitive'` escapes
 * the intended prefix and `filename: 'foo/bar.exe'` injects a
 * directory separator — both let a hostile caller (or a confused
 * authenticated caller) write to objects outside their intended
 * scope. These helpers reject the dangerous shapes loudly before the
 * adapter ever signs anything.
 *
 * Note: the local/bun adapters already have a defense-in-depth check
 * via `path.relative()` in `resolvePath()`. The S3 adapter doesn't,
 * because S3 keys are opaque strings — there's no filesystem `..`
 * resolution to lean on. That's exactly why we need this layer.
 */

/**
 * Thrown when `sanitizePresignedDir` or `sanitizePresignedFilename`
 * detects a value that would escape the intended scope. The `reason`
 * discriminant lets callers distinguish "you passed an absolute path"
 * from "you passed a null byte" if they want to surface that in error
 * messages — most callers can just `catch (e: PathSanitizeError)` and
 * return a 400.
 */
export class PathSanitizeError extends Error {
  readonly reason:
    | 'empty'
    | 'not-string'
    | 'absolute-path'
    | 'traversal'
    | 'null-byte'
    | 'control-char'
    | 'too-long'
    | 'invalid-char'
    | 'invalid-extension'

  constructor(message: string, reason: PathSanitizeError['reason']) {
    super(message)
    this.name = 'PathSanitizeError'
    this.reason = reason
  }
}

/**
 * Maximum length of a single dir segment or filename. Object stores
 * (S3, R2, GCS) all have key-length limits in the low thousands. We
 * cap individual components at 255 to mirror filesystem `NAME_MAX`,
 * which is also where most browser/OS combos start choking when
 * downloading attachments.
 */
const MAX_COMPONENT_LENGTH = 255

/**
 * Strict character set for individual dir segments. Allows letters,
 * digits, dot, dash, underscore. Forbids whitespace, path separators,
 * shell metacharacters, and Unicode (callers who genuinely need
 * Unicode keys should encode to a stable scheme before passing in).
 */
const ALLOWED_DIR_CHAR = /^[A-Za-z0-9._-]+$/

/**
 * Strict character set for filenames. Same as dir segments plus the
 * extension dot (which `ALLOWED_DIR_CHAR` already allows).
 */
const ALLOWED_FILENAME_CHAR = /^[A-Za-z0-9._-]+$/

/**
 * Allowed extension characters — lowercase alphanumerics only. We
 * lowercase before checking, so `.JPG` becomes `.jpg`. Matches the
 * stricter validator in `put-file.ts:extFromOriginalName`.
 */
const ALLOWED_EXTENSION = /^[a-z0-9]+$/

/**
 * Sanitize a `dir` parameter for `presignedUploadUrl`. Returns the
 * cleaned dir on success (trailing slashes stripped, empty string
 * preserved as-is) or throws `PathSanitizeError` on:
 *
 *  - non-string input
 *  - absolute paths (`/foo`)
 *  - traversal segments (`..`, `foo/../bar`)
 *  - null bytes (`foo\0bar`) — these get stripped by some S3 SDKs
 *    silently
 *  - control characters (`\r`, `\n`, etc.) — log-injection risk
 *  - segments outside `[A-Za-z0-9._-]`
 *
 * Empty / undefined dir is allowed (it means "write at the root of
 * the configured prefix").
 */
export function sanitizePresignedDir(dir: string | undefined): string {
  if (dir === undefined || dir === '') return ''
  if (typeof dir !== 'string')
    throw new PathSanitizeError(`dir must be a string, got ${typeof dir}`, 'not-string')

  // Strip leading and trailing slashes, then split. Empty segments
  // from consecutive `//` get filtered out so they can't be used to
  // smuggle a `..` past the per-segment check.
  const trimmed = dir.replace(/^\/+/, '').replace(/\/+$/, '')
  if (dir.startsWith('/'))
    throw new PathSanitizeError(`dir must not be absolute: '${dir}'`, 'absolute-path')

  if (trimmed === '') return ''

  if (trimmed.includes('\0'))
    throw new PathSanitizeError(`dir contains null byte`, 'null-byte')
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(trimmed))
    throw new PathSanitizeError(`dir contains control character`, 'control-char')

  const segments = trimmed.split('/')
  for (const segment of segments) {
    if (segment === '' || segment === '.' || segment === '..')
      throw new PathSanitizeError(`dir contains traversal or empty segment: '${dir}'`, 'traversal')
    if (segment.length > MAX_COMPONENT_LENGTH)
      throw new PathSanitizeError(`dir segment exceeds ${MAX_COMPONENT_LENGTH} chars`, 'too-long')
    if (!ALLOWED_DIR_CHAR.test(segment))
      throw new PathSanitizeError(`dir segment contains disallowed character: '${segment}'`, 'invalid-char')
  }

  return segments.join('/')
}

/**
 * Sanitize a `filename` parameter for `presignedUploadUrl`. Returns
 * the cleaned filename on success or throws `PathSanitizeError`.
 *
 * Rejects path separators, traversal tokens, null bytes, control
 * characters, and disallowed characters. Validates the extension
 * against a strict alphanumeric pattern (no `.exe.jpg` smuggling —
 * the caller is responsible for matching extension to expected
 * content type via the contentType the URL was signed for).
 */
export function sanitizePresignedFilename(filename: string): string {
  if (typeof filename !== 'string')
    throw new PathSanitizeError(`filename must be a string, got ${typeof filename}`, 'not-string')
  if (filename === '')
    throw new PathSanitizeError(`filename must not be empty`, 'empty')
  if (filename.length > MAX_COMPONENT_LENGTH)
    throw new PathSanitizeError(`filename exceeds ${MAX_COMPONENT_LENGTH} chars`, 'too-long')

  if (filename.includes('\0'))
    throw new PathSanitizeError(`filename contains null byte`, 'null-byte')
  // eslint-disable-next-line no-control-regex
  if (/[\x00-\x1F\x7F]/.test(filename))
    throw new PathSanitizeError(`filename contains control character`, 'control-char')

  if (filename.includes('/') || filename.includes('\\'))
    throw new PathSanitizeError(`filename must not contain path separators: '${filename}'`, 'traversal')
  if (filename === '.' || filename === '..' || filename.startsWith('../') || filename.includes('/..'))
    throw new PathSanitizeError(`filename contains traversal token: '${filename}'`, 'traversal')

  if (!ALLOWED_FILENAME_CHAR.test(filename))
    throw new PathSanitizeError(`filename contains disallowed character: '${filename}'`, 'invalid-char')

  // Extension validation: if there's a dot, the trailing part must be
  // pure alphanumerics. Filenames without a dot are allowed (they get
  // an extension appended by the adapter from the contentType).
  const dotIdx = filename.lastIndexOf('.')
  if (dotIdx > 0 && dotIdx < filename.length - 1) {
    const ext = filename.slice(dotIdx + 1).toLowerCase()
    if (!ALLOWED_EXTENSION.test(ext))
      throw new PathSanitizeError(`filename has invalid extension: '.${ext}'`, 'invalid-extension')
  }

  return filename
}

/**
 * Parsed `disk:path` reference returned by {@link parseDiskPath}.
 */
export interface ParsedDiskPath {
  /** Storage disk name (e.g. `'s3'`, `'local'`, `'uploads'`). */
  disk: string
  /** Storage-relative path on that disk. */
  path: string
}

/**
 * Disk-name format. The framework accepts arbitrary alphanumeric +
 * dash/underscore disk identifiers from `config/storage.ts` —
 * mirror that here without being more restrictive.
 */
const DISK_NAME_RE = /^[a-z0-9_-]+$/i

/**
 * Parse a `disk:path` reference used by `Storage.copyAcross()` /
 * `moveAcross()` (stacksjs/stacks#1888 S-7).
 *
 * Format: `<disk>:<path>` where:
 *   - `<disk>` is an alphanumeric + dash/underscore disk name
 *   - `<path>` is a storage-relative path (path-traversal /
 *     null-byte / control-char checks applied)
 *
 * Throws {@link PathSanitizeError} on a malformed input — the
 * cross-disk helpers turn that into a clear "bad source" / "bad
 * dest" error rather than crashing inside the adapter.
 *
 * @example
 * ```ts
 * parseDiskPath('s3:user-uploads/foo.jpg')
 * // → { disk: 's3', path: 'user-uploads/foo.jpg' }
 * ```
 */
export function parseDiskPath(input: string): ParsedDiskPath {
  if (typeof input !== 'string' || input.length === 0) {
    throw new PathSanitizeError('disk-path reference is empty', 'empty')
  }
  if (input.includes('\0')) {
    throw new PathSanitizeError('disk-path reference contains a null byte', 'null-byte')
  }
  const colonIdx = input.indexOf(':')
  if (colonIdx <= 0 || colonIdx === input.length - 1) {
    throw new PathSanitizeError(
      `disk-path reference must use '<disk>:<path>' format, got '${input}'`,
      'invalid-char',
    )
  }
  const disk = input.slice(0, colonIdx)
  const path = input.slice(colonIdx + 1)

  if (!DISK_NAME_RE.test(disk)) {
    throw new PathSanitizeError(
      `disk name '${disk}' is invalid (alphanumeric + '-' / '_' only)`,
      'invalid-char',
    )
  }

  if (path.startsWith('/') || /^[A-Za-z]:[\\/]/.test(path)) {
    throw new PathSanitizeError(`disk-path '${path}' is absolute`, 'absolute-path')
  }
  if (path.includes('\0')) {
    throw new PathSanitizeError('disk-path contains a null byte', 'null-byte')
  }
  for (let i = 0; i < path.length; i++) {
    const code = path.charCodeAt(i)
    if (code < 0x20 || code === 0x7F) {
      throw new PathSanitizeError(`disk-path contains a control character at index ${i}`, 'control-char')
    }
  }
  const segments = path.split(/[/\\]/)
  if (segments.some(seg => seg === '..')) {
    throw new PathSanitizeError(`disk-path '${path}' contains a '..' segment`, 'traversal')
  }

  return { disk, path }
}
