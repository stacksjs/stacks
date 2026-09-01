import type { FormDefinition, FormFieldDefinition } from './types'
import { config } from '@stacksjs/config'

/**
 * File uploads for a form's `file` fields.
 *
 * `config/forms.ts` has declared `uploads: { disk, maxSizeMb, allowedTypes }`
 * since the bundle shipped, fully typed and documented — and nothing read any
 * of it. An app could set `maxSizeMb: 2` and `allowedTypes: ['pdf']` and
 * neither was ever applied, because the only check on a `file` field was that
 * its value is a string under 1024 characters. stacksjs/stacks#2406.
 *
 * Enforced server-side rather than through a presigned policy, deliberately.
 * A presign lets the browser upload straight to storage, which means the size
 * ceiling has to be expressed in the policy and the type ceiling cannot really
 * be expressed at all — S3 checks the `Content-Type` the CLIENT declared. Here
 * the server has the bytes, so both limits are checked against what actually
 * arrived, and the same code path works on a local disk. A public form is not
 * a bulk-upload surface; 10MB through the app is not the bottleneck.
 */

/** Resolved ceilings for one file field. */
export interface UploadLimits {
  /** Storage disk to write to. */
  disk?: string
  /** Per-file ceiling in bytes. */
  maxBytes: number
  /** Allowed extensions, lowercase and without a dot. Empty means "any". */
  allowedTypes: string[]
}

const DEFAULT_MAX_SIZE_MB = 10
const DEFAULT_ALLOWED_TYPES = ['pdf', 'png', 'jpg', 'jpeg', 'webp', 'doc', 'docx']

interface FormsUploadConfig {
  disk?: string
  maxSizeMb?: number
  allowedTypes?: string[]
}

function uploadConfig(): FormsUploadConfig {
  return (config as { forms?: { uploads?: FormsUploadConfig } }).forms?.uploads ?? {}
}

/** Lowercase extension of a filename, without the dot. `''` when it has none. */
export function extensionOf(filename: string): string {
  const base = filename.split('/').pop() ?? ''
  const dot = base.lastIndexOf('.')
  return dot > 0 ? base.slice(dot + 1).toLowerCase() : ''
}

/**
 * The ceilings for one field: the field's own options win over the app's
 * defaults, which win over the framework's.
 *
 * A field saying `accept: ['pdf']` on a form whose config allows images is
 * asking for something narrower, and narrower is the answer that cannot
 * surprise anyone. The reverse — a field widening past the app's config — is
 * NOT honoured: the config is the app's ceiling and a form builder should not
 * be able to raise it.
 */
export function resolveUploadLimits(field: FormFieldDefinition): UploadLimits {
  const appConfig = uploadConfig()
  const appMaxMb = appConfig.maxSizeMb ?? DEFAULT_MAX_SIZE_MB
  const appTypes = (appConfig.allowedTypes ?? DEFAULT_ALLOWED_TYPES).map(type => type.toLowerCase().replace(/^\./, ''))

  const fieldMaxMb = field.options?.maxSizeMb
  const maxMb = typeof fieldMaxMb === 'number' && fieldMaxMb > 0
    ? Math.min(fieldMaxMb, appMaxMb)
    : appMaxMb

  const fieldTypes = field.options?.accept?.map(type => type.toLowerCase().replace(/^\./, ''))
  const allowedTypes = fieldTypes?.length
    ? fieldTypes.filter(type => appTypes.includes(type))
    : appTypes

  return { disk: appConfig.disk, maxBytes: Math.round(maxMb * 1024 * 1024), allowedTypes }
}

/**
 * The storage prefix that owns a form's uploads.
 *
 * `validate.ts` has always said "the prefix pins it to this form's upload
 * area, so a submission cannot reference someone else's file" — while checking
 * only the value's length. This is the prefix that comment was describing, and
 * `checkField` now actually tests it.
 */
export function formUploadPrefix(form: Pick<FormDefinition, 'uuid'>): string {
  return `forms/${form.uuid}`
}

/** Is this stored path inside the form's own upload area? */
export function isOwnedUploadPath(form: Pick<FormDefinition, 'uuid'>, path: unknown): boolean {
  if (typeof path !== 'string' || path.length === 0 || path.length > 1024)
    return false

  // No traversal, no absolute paths, no protocol-relative or absolute URLs —
  // any of which would take the value out of the prefix while still starting
  // with it.
  if (path.includes('..') || path.startsWith('/') || path.includes('://') || path.includes('\\'))
    return false

  return path.startsWith(`${formUploadPrefix(form)}/`)
}

/**
 * Why an upload was refused, in the shape the endpoint answers with.
 *
 * The status is the literal union rather than `number` so the route can hand
 * it straight to `response.json`, whose `ResponseStatus` is a union of literal
 * codes. A widened `number` there forces a cast at the call site, and a cast
 * is how a status nobody intended eventually gets returned.
 */
export interface UploadRejection {
  /** 413 for a file over the ceiling, 422 for anything else about it. */
  status: 413 | 422
  message: string
}

/**
 * Check one incoming file against a field's ceilings.
 *
 * Returns null when it is acceptable. The size check comes first: an oversized
 * file of a disallowed type should report the size, because that is the one
 * the person cannot fix by renaming.
 */
export function checkUpload(
  field: FormFieldDefinition,
  file: { name?: string, size?: number },
  limits: UploadLimits = resolveUploadLimits(field),
): UploadRejection | null {
  const size = Number(file.size ?? 0)
  if (!Number.isFinite(size) || size <= 0)
    return { status: 422, message: `${field.label} upload is empty.` }

  if (size > limits.maxBytes) {
    const mb = (limits.maxBytes / (1024 * 1024)).toFixed(limits.maxBytes % (1024 * 1024) === 0 ? 0 : 1)
    return { status: 413, message: `${field.label} must be ${mb} MB or smaller.` }
  }

  const extension = extensionOf(String(file.name ?? ''))
  if (limits.allowedTypes.length > 0 && !limits.allowedTypes.includes(extension)) {
    return {
      status: 422,
      message: `${field.label} must be one of: ${limits.allowedTypes.join(', ')}.`,
    }
  }

  return null
}

/** The `file` field with this name on a form, or null. */
export function fileFieldNamed(form: FormDefinition, name: unknown): FormFieldDefinition | null {
  if (typeof name !== 'string' || !name)
    return null

  const field = form.fields.find(candidate => candidate.name === name)
  return field && field.type === 'file' ? field : null
}
