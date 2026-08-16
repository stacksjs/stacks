import type { FieldOptions, FormDefinition, FormFieldDefinition, SubmissionErrors, ValidateSubmissionResult } from './types'
import { visibleFields } from './conditions'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Loose on purpose: parents type phone numbers every way imaginable, and a
// school would rather have "(310) 555-0199 cell" than a rejection.
const PHONE_RE = /^[\d\s()+.\-ext]{7,32}$/i

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

function checkField(field: FormFieldDefinition, value: unknown): string | null {
  const options: FieldOptions = field.options ?? {}

  if (isBlank(value))
    return field.required ? `${field.label} is required` : null

  switch (field.type) {
    case 'text':
    case 'textarea': {
      if (typeof value !== 'string')
        return `${field.label} must be text`
      const max = options.max ?? (field.type === 'text' ? 500 : 10000)
      if (value.length > max)
        return `${field.label} must be at most ${max} characters`
      if (options.min && value.length < options.min)
        return `${field.label} must be at least ${options.min} characters`
      return null
    }

    case 'email':
      return typeof value === 'string' && EMAIL_RE.test(value) && value.length <= 255
        ? null
        : `${field.label} must be a valid email address`

    case 'phone':
      return typeof value === 'string' && PHONE_RE.test(value)
        ? null
        : `${field.label} must be a valid phone number`

    case 'select':
    case 'radio': {
      const choices = (options.choices ?? []).map(choice => choice.value)
      return typeof value === 'string' && choices.includes(value)
        ? null
        : `${field.label} must be one of the listed choices`
    }

    case 'checkbox':
      return typeof value === 'boolean' || value === 'true' || value === 'false'
        ? null
        : `${field.label} must be a yes or no`

    case 'date': {
      if (typeof value !== 'string' || Number.isNaN(Date.parse(value)))
        return `${field.label} must be a valid date`
      return null
    }

    case 'file':
      // The value is the storage path returned by the presign flow. The
      // prefix pins it to this form's upload area, so a submission cannot
      // reference someone else's file.
      return typeof value === 'string' && value.length <= 1024
        ? null
        : `${field.label} upload is invalid`

    case 'currency': {
      const cents = Number(value)
      if (!Number.isInteger(cents) || cents < 0)
        return `${field.label} must be a whole amount`
      if (options.min !== undefined && cents < options.min)
        return `${field.label} must be at least ${options.min}`
      if (options.max !== undefined && cents > options.max)
        return `${field.label} must be at most ${options.max}`
      return null
    }

    case 'section_break':
      return null

    default:
      return `${field.label} has an unknown type`
  }
}

function coerce(field: FormFieldDefinition, value: unknown): unknown {
  if (field.type === 'checkbox')
    return value === true || value === 'true'
  if (field.type === 'currency')
    return Number(value)
  return value
}

function pickEmail(form: FormDefinition, fields: FormFieldDefinition[], values: Record<string, unknown>): string | null {
  const named = form.settings.emailField
  const field = named
    ? fields.find(candidate => candidate.name === named)
    : fields.find(candidate => candidate.type === 'email')
  const value = field ? values[field.name] : undefined
  return typeof value === 'string' && value ? value.toLowerCase() : null
}

function pickName(form: FormDefinition, fields: FormFieldDefinition[], values: Record<string, unknown>): string | null {
  const named = form.settings.nameField
  const field = named
    ? fields.find(candidate => candidate.name === named)
    : fields.find(candidate => candidate.type === 'text' && /name/i.test(candidate.name))
  const value = field ? values[field.name] : undefined
  return typeof value === 'string' && value ? value : null
}

/**
 * Server-computed payment amount. NEVER trusts a client total:
 * `fixed` reads the form's setting, `field_sum` adds the currency fields'
 * validated values, `user_amount` takes the named field but enforces the
 * configured floor.
 */
export function computeAmountCents(form: FormDefinition, fields: FormFieldDefinition[], values: Record<string, unknown>): number | null {
  const payment = form.settings.payment
  if (!payment)
    return null

  switch (payment.mode) {
    case 'fixed':
      return payment.amountCents ?? 0

    case 'field_sum':
      return fields
        .filter(field => field.type === 'currency')
        .reduce((sum, field) => sum + (Number(values[field.name]) || 0), 0)

    case 'user_amount': {
      const field = payment.amountField
        ? fields.find(candidate => candidate.name === payment.amountField)
        : fields.find(candidate => candidate.type === 'currency')
      const cents = field ? Number(values[field.name]) || 0 : 0
      const floor = payment.minAmountCents ?? 0
      return Math.max(cents, floor)
    }

    default:
      return null
  }
}

/**
 * Validate an untrusted submission against a form definition.
 *
 * Visibility first: required-ness and value acceptance apply only to fields
 * visible under the submitted values, and values for hidden or unknown
 * fields are DISCARDED - the stored document contains exactly what the
 * person could see.
 */
export function validateSubmission(form: FormDefinition, payload: Record<string, unknown>): ValidateSubmissionResult {
  const fields = visibleFields(form.fields, payload)
  const errors: SubmissionErrors = {}
  const values: Record<string, unknown> = {}

  for (const field of fields) {
    if (field.type === 'section_break')
      continue

    const raw = payload[field.name]
    const problem = checkField(field, raw)
    if (problem) {
      errors[field.name] = problem
      continue
    }
    if (!isBlank(raw))
      values[field.name] = coerce(field, raw)
  }

  if (Object.keys(errors).length > 0)
    return { ok: false, errors }

  return {
    ok: true,
    values,
    email: pickEmail(form, fields, values),
    name: pickName(form, fields, values),
    amountCents: computeAmountCents(form, fields, values),
  }
}
