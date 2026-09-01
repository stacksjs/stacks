/**
 * File uploads on a form's `file` fields (stacksjs/stacks#2406).
 *
 * `config/forms.ts` declared `uploads: { disk, maxSizeMb, allowedTypes }` from
 * the day the bundle shipped — typed, documented, and read by nothing. An app
 * could set `maxSizeMb: 2` and `allowedTypes: ['pdf']` and neither was applied,
 * because the only check on a `file` field was that its value is a string under
 * 1024 characters.
 *
 * The same check carried a comment claiming "the prefix pins it to this form's
 * upload area, so a submission cannot reference someone else's file" — which
 * described an ownership test the code did not perform.
 */

import type { FormDefinition, FormFieldDefinition } from '../src/types'
import { describe, expect, it } from 'bun:test'
import {
  checkUpload,
  extensionOf,
  fileFieldNamed,
  formUploadPrefix,
  isOwnedUploadPath,
  resolveUploadLimits,
} from '../src/uploads'
import { validateSubmission } from '../src/validate'

const UUID = 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'

function fileField(options: FormFieldDefinition['options'] = {}): FormFieldDefinition {
  return {
    name: 'transcript',
    label: 'Transcript',
    type: 'file',
    required: false,
    position: 1,
    width: 'full',
    options,
    conditions: null,
  }
}

function formWith(field: FormFieldDefinition): FormDefinition {
  return {
    id: 1,
    uuid: UUID,
    siteId: null,
    name: 'Application',
    handle: 'application',
    status: 'active',
    settings: {},
    fields: [field],
  }
}

const MB = 1024 * 1024

describe('extensionOf', () => {
  it('lowercases and drops the dot', () => {
    expect(extensionOf('Report.PDF')).toBe('pdf')
    expect(extensionOf('a/b/photo.JPEG')).toBe('jpeg')
  })

  it('is empty for a name with no extension, or a leading-dot name', () => {
    expect(extensionOf('README')).toBe('')
    // `.env` is a dotfile, not an `env` file — treating it as an extension is
    // how an allowlist gets talked past.
    expect(extensionOf('.env')).toBe('')
  })

  it('takes the last extension, not the first', () => {
    expect(extensionOf('payload.pdf.exe')).toBe('exe')
  })
})

describe('resolveUploadLimits', () => {
  it('falls back to the framework defaults when nothing is configured', () => {
    const limits = resolveUploadLimits(fileField())

    expect(limits.maxBytes).toBe(10 * MB)
    expect(limits.allowedTypes).toContain('pdf')
  })

  it('lets a field narrow the size, but not widen it', () => {
    expect(resolveUploadLimits(fileField({ maxSizeMb: 2 })).maxBytes).toBe(2 * MB)
    // The config is the app's ceiling; a form builder must not be able to
    // raise it by editing one field.
    expect(resolveUploadLimits(fileField({ maxSizeMb: 500 })).maxBytes).toBe(10 * MB)
  })

  it('lets a field narrow the types, intersecting rather than replacing', () => {
    expect(resolveUploadLimits(fileField({ accept: ['pdf'] })).allowedTypes).toEqual(['pdf'])
    // `exe` is not in the app's list, so accepting it here must not admit it.
    expect(resolveUploadLimits(fileField({ accept: ['pdf', 'exe'] })).allowedTypes).toEqual(['pdf'])
  })

  it('normalises a leading dot and mixed case on the field', () => {
    expect(resolveUploadLimits(fileField({ accept: ['.PDF'] })).allowedTypes).toEqual(['pdf'])
  })
})

describe('checkUpload', () => {
  const field = fileField()

  it('accepts a file inside both ceilings', () => {
    expect(checkUpload(field, { name: 'transcript.pdf', size: 1024 })).toBeNull()
  })

  it('rejects a file over the size ceiling with 413', () => {
    const rejection = checkUpload(field, { name: 'transcript.pdf', size: 11 * MB })

    expect(rejection?.status).toBe(413)
    expect(rejection?.message).toContain('10 MB')
  })

  it('rejects a disallowed type with 422', () => {
    const rejection = checkUpload(field, { name: 'payload.exe', size: 1024 })

    expect(rejection?.status).toBe(422)
    expect(rejection?.message).toContain('Transcript')
  })

  it('reports the size first when a file fails both', () => {
    // The size is the one the person cannot fix by renaming the file.
    expect(checkUpload(field, { name: 'payload.exe', size: 99 * MB })?.status).toBe(413)
  })

  it('rejects an empty file', () => {
    expect(checkUpload(field, { name: 'x.pdf', size: 0 })?.status).toBe(422)
  })
})

describe('isOwnedUploadPath', () => {
  const form = formWith(fileField())
  const prefix = formUploadPrefix(form)

  it('accepts a path under this form’s prefix', () => {
    expect(isOwnedUploadPath(form, `${prefix}/transcript.pdf`)).toBe(true)
  })

  it('rejects another form’s upload, which the old check accepted', () => {
    expect(isOwnedUploadPath(form, 'forms/99999999-0000-0000-0000-000000000000/secret.pdf')).toBe(false)
  })

  it('rejects traversal, absolute paths and URLs that start with the prefix', () => {
    expect(isOwnedUploadPath(form, `${prefix}/../../etc/passwd`)).toBe(false)
    expect(isOwnedUploadPath(form, `/${prefix}/x.pdf`)).toBe(false)
    expect(isOwnedUploadPath(form, `https://evil.example/${prefix}/x.pdf`)).toBe(false)
    expect(isOwnedUploadPath(form, `${prefix}\\..\\x.pdf`)).toBe(false)
  })

  it('rejects the bare prefix, a non-string, and an over-long path', () => {
    expect(isOwnedUploadPath(form, prefix)).toBe(false)
    expect(isOwnedUploadPath(form, 42)).toBe(false)
    expect(isOwnedUploadPath(form, `${prefix}/${'a'.repeat(1100)}`)).toBe(false)
  })
})

describe('fileFieldNamed', () => {
  const form = formWith(fileField())

  it('finds the file field by name', () => {
    expect(fileFieldNamed(form, 'transcript')?.name).toBe('transcript')
  })

  it('refuses a field that is not a file field', () => {
    const text: FormFieldDefinition = { ...fileField(), name: 'note', type: 'text' }
    expect(fileFieldNamed(formWith(text), 'note')).toBeNull()
  })

  it('refuses an unknown or non-string name', () => {
    expect(fileFieldNamed(form, 'nope')).toBeNull()
    expect(fileFieldNamed(form, 7)).toBeNull()
  })
})

describe('validateSubmission on a file field', () => {
  const form = formWith(fileField())
  const prefix = formUploadPrefix(form)

  it('accepts a path this form owns', () => {
    const result = validateSubmission(form, { transcript: `${prefix}/transcript.pdf` })

    expect(result.ok).toBe(true)
  })

  it('rejects a path belonging to another form', () => {
    const result = validateSubmission(form, { transcript: 'forms/00000000-0000-0000-0000-000000000000/x.pdf' })

    expect(result.ok).toBe(false)
    expect(result.ok === false && result.errors.transcript).toContain('upload is invalid')
  })

  it('still treats a blank optional upload as fine', () => {
    expect(validateSubmission(form, {}).ok).toBe(true)
  })

  it('rejects an arbitrary string, which the length-only check accepted', () => {
    expect(validateSubmission(form, { transcript: 'anything at all' }).ok).toBe(false)
  })
})
