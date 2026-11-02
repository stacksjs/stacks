import type { FieldOptions, FormDefinition, FormFieldDefinition, SubmissionErrors, ValidateSubmissionResult } from './types'
import { isCalendarDate } from '@stacksjs/datetime'
import { isReservedFieldName } from './field-name'
import { visibleFields } from './conditions'
import { isOwnedUploadPath } from './uploads'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
// Loose on purpose: parents type phone numbers every way imaginable, and a
// school would rather have "(310) 555-0199 cell" than a rejection.
const PHONE_RE = /^[\d\s()+.\-ext]{7,32}$/i

function isBlank(value: unknown): boolean {
  return value === undefined || value === null || (typeof value === 'string' && value.trim() === '')
}

function currencyCents(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^\d+$/.test(value))) return null
  const cents = Number(value)
  return Number.isSafeInteger(cents) && cents >= 0 ? cents : null
}

function checkField(field: FormFieldDefinition, value: unknown, form: Pick<FormDefinition, 'uuid'>): string | null {
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
      if (!isCalendarDate(value))
        return `${field.label} must be a valid date`
      return null
    }

    case 'file':
      // The value is the storage path the upload endpoint returned, and it has
      // to sit under THIS form's prefix.
      //
      // That was the intent all along — the comment here used to say "the
      // prefix pins it to this form's upload area, so a submission cannot
      // reference someone else's file" — but the check was `length <= 1024`
      // and nothing else, so a submission could name any path it liked,
      // including another form's uploads. `isOwnedUploadPath` is that
      // sentence, enforced (stacksjs/stacks#2406).
      return isOwnedUploadPath(form, value)
        ? null
        : `${field.label} upload is invalid`

    case 'currency': {
      const cents = currencyCents(value)
      if (cents === null)
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

  const amount = (value: unknown): number => {
    const cents = currencyCents(value ?? 0)
    if (cents === null) throw new RangeError('Payment amount must be nonnegative safe integer cents')
    return cents
  }
  switch (payment.mode) {
    case 'fixed':
      return amount(payment.amountCents)

    case 'field_sum':
      return fields.filter(field => field.type === 'currency').reduce((sum, field) => amount(sum + amount(values[field.name])), 0)

    case 'user_amount': {
      const field = payment.amountField
        ? form.fields.find(candidate => candidate.name === payment.amountField)
        : form.fields.find(candidate => candidate.type === 'currency')
      if (!field || field.type !== 'currency') throw new RangeError('Payment source must be a currency field')
      const cents = fields.some(candidate => candidate.name === field.name) ? amount(values[field.name]) : 0
      return Math.max(cents, amount(payment.minAmountCents))
    }

    default:
      throw new RangeError('Unknown payment mode')
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
  if (form.fields.some(field => isReservedFieldName(field.name)))
    return { ok: false, errors: { _form: 'This form has an invalid field name.' } }
  let fields: FormFieldDefinition[]
  try { fields = visibleFields(form.fields, payload) }
  catch (error) {
    if (!(error instanceof RangeError)) throw error
    return { ok: false, errors: { _form: 'This form has invalid field conditions.' } }
  }
  const errors: SubmissionErrors = Object.create(null)
  const values: Record<string, unknown> = Object.create(null)

  for (const field of fields) {
    if (field.type === 'section_break')
      continue

    const raw = Object.hasOwn(payload, field.name) ? payload[field.name] : undefined
    const problem = checkField(field, raw, form)
    if (problem) {
      errors[field.name] = problem
      continue
    }
    if (!isBlank(raw))
      values[field.name] = coerce(field, raw)
  }

  if (Object.keys(errors).length > 0)
    return { ok: false, errors }

  let amountCents: number | null
  try { amountCents = computeAmountCents(form, fields, values) }
  catch (error) {
    if (!(error instanceof RangeError)) throw error
    return { ok: false, errors: { _form: 'This form has an invalid payment amount.' } }
  }
  return {
    ok: true,
    values,
    email: pickEmail(form, fields, values),
    name: pickName(form, fields, values),
    amountCents,
  }
}
