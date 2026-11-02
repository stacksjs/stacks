import type { FieldConditions, FieldOptions, FormDefinition, FormFieldDefinition, FormFieldType, FormSettings, PublicFormDefinition } from './types'
import { db } from '@stacksjs/database/runtime'

function parseJson<T>(raw: unknown, fallback: T): T {
  let decoded = raw
  if (typeof raw === 'string') {
    try { decoded = JSON.parse(raw) }
    catch { return fallback }
  }
  return decoded !== null && typeof decoded === 'object' && !Array.isArray(decoded)
    ? Object.fromEntries(Object.entries(decoded).filter(([, value]) => value !== null)) as T
    : fallback
}

/** Nested JSON must have the shapes the renderer and validator actually consume. */
function validField(field: FormFieldDefinition): boolean {
  const options = field.options
  if (options.choices !== undefined && (!Array.isArray(options.choices) || !options.choices.every(choice => choice !== null && typeof choice === 'object' && typeof choice.label === 'string' && typeof choice.value === 'string'))) return false
  if (options.accept !== undefined && (!Array.isArray(options.accept) || !options.accept.every(type => typeof type === 'string'))) return false
  const conditions = field.conditions
  if (!conditions) return true
  return ['show', 'hide'].includes(conditions.action) && ['all', 'any'].includes(conditions.logic)
    && Array.isArray(conditions.rules) && conditions.rules.every(rule => rule !== null && typeof rule === 'object' && typeof rule.field === 'string'
      && ['eq', 'neq', 'contains', 'gt', 'lt', 'empty', 'not_empty'].includes(rule.op)
      && (rule.value === undefined || typeof rule.value === 'string' || typeof rule.value === 'number'))
}

function validSettings(settings: FormSettings): boolean {
  if (settings.submitLabel !== undefined && typeof settings.submitLabel !== 'string') return false
  if (settings.notifyEmails !== undefined && (!Array.isArray(settings.notifyEmails) || !settings.notifyEmails.every(email => typeof email === 'string'))) return false
  if (settings.confirmation !== undefined && (!settings.confirmation || typeof settings.confirmation !== 'object'
    || !['message', 'redirect'].includes(settings.confirmation.type) || typeof settings.confirmation.value !== 'string')) return false
  if (settings.payment !== undefined && (!settings.payment || typeof settings.payment !== 'object'
    || !['fixed', 'user_amount', 'field_sum'].includes(settings.payment.mode))) return false
  return true
}

interface FormRow {
  id: number
  uuid: string
  site_id: number | null
  name: string
  handle: string
  status: string
  settings: string | null
}

interface FieldRow {
  name: string
  label: string
  type: string
  required: number | boolean
  position: number | null
  width: string | null
  options: string | null
  conditions: string | null
}

function rowToField(row: FieldRow): FormFieldDefinition {
  return {
    name: row.name,
    label: row.label,
    type: row.type as FormFieldType,
    required: row.required === true || row.required === 1,
    position: Number(row.position ?? 0),
    width: row.width === 'half' ? 'half' : 'full',
    options: parseJson<FieldOptions>(row.options, {}),
    conditions: parseJson<FieldConditions | null>(row.conditions, null),
  }
}

/**
 * Load a form + its fields by uuid. `siteId` is REQUIRED and matched against
 * the row (null site allowed for single-site apps passing null): a form uuid
 * from one school must not render or accept submissions on another school's
 * host.
 */
export async function loadFormByUuid(uuid: string, siteId: number | null): Promise<FormDefinition | null> {
  const form = await db
    .selectFrom('forms')
    .where('uuid', '=', uuid)
    .where('site_id', siteId === null ? 'is' : '=', siteId)
    .select(['id', 'uuid', 'site_id', 'name', 'handle', 'status', 'settings'])
    .executeTakeFirst() as FormRow | undefined

  if (!form)
    return null

  const fields = await db
    .selectFrom('form_fields')
    .where('form_id', '=', form.id)
    .select(['name', 'label', 'type', 'required', 'position', 'width', 'options', 'conditions'])
    .orderBy('position', 'asc')
    .execute() as unknown as FieldRow[]

  const resolvedFields = fields.map(rowToField)
  const settings = parseJson<FormSettings>(form.settings, {})
  if (!validSettings(settings) || !resolvedFields.every(validField)) return null

  return {
    id: Number(form.id),
    uuid: form.uuid,
    siteId: form.site_id == null ? null : Number(form.site_id),
    name: form.name,
    handle: form.handle,
    status: (['draft', 'active', 'closed'].includes(form.status) ? form.status : 'draft') as FormDefinition['status'],
    settings,
    fields: resolvedFields,
  }
}

/**
 * The client-facing definition: everything a renderer needs, nothing an
 * attacker wants (notify addresses, payment internals beyond what the UI
 * must show).
 */
export function publicDefinition(form: FormDefinition): PublicFormDefinition {
  return {
    uuid: form.uuid,
    name: form.name,
    status: form.status,
    submitLabel: form.settings.submitLabel ?? 'Submit',
    confirmation: form.settings.confirmation?.type === 'message' ? form.settings.confirmation.value : null,
    payment: form.settings.payment
      ? {
          mode: form.settings.payment.mode,
          amountCents: form.settings.payment.mode === 'fixed' ? form.settings.payment.amountCents ?? 0 : undefined,
          currency: form.settings.payment.currency ?? 'USD',
          minAmountCents: form.settings.payment.minAmountCents,
        }
      : null,
    fields: form.fields
      .sort((a, b) => a.position - b.position)
      .map(field => ({
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.required,
        width: field.width,
        options: {
          placeholder: field.options.placeholder,
          choices: field.options.choices,
          min: field.options.min,
          max: field.options.max,
          accept: field.options.accept,
        },
        conditions: field.conditions,
      })),
  }
}
