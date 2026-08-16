import type { FieldConditions, FieldOptions, FormDefinition, FormFieldDefinition, FormFieldType, FormSettings } from './types'
import { db } from '@stacksjs/database'

function parseJson<T>(raw: unknown, fallback: T): T {
  if (raw && typeof raw === 'object')
    return raw as T
  if (typeof raw === 'string' && raw) {
    try {
      return JSON.parse(raw) as T
    }
    catch {
      return fallback
    }
  }
  return fallback
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
    .select(['id', 'uuid', 'site_id', 'name', 'handle', 'status', 'settings'])
    .executeTakeFirst() as FormRow | undefined

  if (!form)
    return null

  if (siteId !== null && form.site_id !== null && Number(form.site_id) !== siteId)
    return null

  const fields = await db
    .selectFrom('form_fields')
    .where('form_id', '=', form.id)
    .select(['name', 'label', 'type', 'required', 'position', 'width', 'options', 'conditions'])
    .orderBy('position', 'asc')
    .execute() as FieldRow[]

  return {
    id: Number(form.id),
    uuid: form.uuid,
    siteId: form.site_id == null ? null : Number(form.site_id),
    name: form.name,
    handle: form.handle,
    status: (['draft', 'active', 'closed'].includes(form.status) ? form.status : 'draft') as FormDefinition['status'],
    settings: parseJson<FormSettings>(form.settings, {}),
    fields: fields.map(rowToField),
  }
}

/**
 * The client-facing definition: everything a renderer needs, nothing an
 * attacker wants (notify addresses, payment internals beyond what the UI
 * must show).
 */
export function publicDefinition(form: FormDefinition): Record<string, unknown> {
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
