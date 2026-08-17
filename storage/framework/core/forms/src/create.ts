import type { FormDefinition, FormFieldDefinition, FormFieldType, FormSettings } from './types'
import { db } from '@stacksjs/database'
import { loadFormByUuid } from './definition'

/**
 * Creating a form.
 *
 * The package could read a form, validate a submission against it, notify on
 * it and export it - but not make one. Every app that wanted a form in code
 * (a seeder, an onboarding step, a "give this tenant the standard enquiry
 * form" button) had to write the Form + FormField inserts itself, which means
 * every app also had to know that `options` and `conditions` are JSON columns
 * and that fields carry their own `position`.
 *
 * `handle` is the identity, scoped to the site (there is a unique index on
 * `site_id, handle`), so this is idempotent: provisioning the same form twice
 * updates the one that exists rather than failing on the constraint or
 * quietly making a second.
 */

export interface CreateFormFieldInput {
  name: string
  label: string
  type: FormFieldType
  required?: boolean
  width?: 'full' | 'half'
  options?: Record<string, unknown>
  conditions?: Record<string, unknown> | null
}

export interface CreateFormInput {
  /** Stable identifier within the site, e.g. `admissions-enquiry`. */
  handle: string
  name: string
  status?: 'draft' | 'active' | 'closed'
  settings?: FormSettings
  fields: CreateFormFieldInput[]
}

export interface CreatedForm {
  id: number
  uuid: string
  handle: string
  /** False when an existing form with this handle was updated. */
  created: boolean
}

interface FormRow {
  id: number
  uuid: string
}

/**
 * Create or update a form and its fields for one site.
 *
 * Fields are REPLACED rather than merged: a form's fields are a single
 * document in every editor that exists, and merging them by name would leave
 * a removed field behind on the next provision.
 */
export async function createForm(siteId: number | null, input: CreateFormInput): Promise<CreatedForm> {
  const existing = await db
    .selectFrom('forms')
    .select(['id', 'uuid'])
    .where('handle', '=', input.handle)
    .where('site_id', siteId === null ? 'is' : '=', siteId)
    .executeTakeFirst() as FormRow | undefined

  const settings = JSON.stringify(input.settings ?? {})
  let formId: number
  let uuid: string
  let created = false

  if (existing) {
    formId = Number(existing.id)
    uuid = String(existing.uuid)
    await db
      .updateTable('forms')
      .set({ name: input.name, status: input.status ?? 'active', settings })
      .where('id', '=', formId)
      .execute()
  }
  else {
    uuid = crypto.randomUUID()
    await db
      .insertInto('forms')
      .values({
        uuid,
        site_id: siteId,
        name: input.name,
        handle: input.handle,
        status: input.status ?? 'active',
        settings,
      })
      .execute()

    const row = await db
      .selectFrom('forms')
      .select(['id'])
      .where('uuid', '=', uuid)
      .executeTakeFirst() as { id: number } | undefined

    formId = Number(row?.id)
    created = true
  }

  await db.deleteFrom('form_fields').where('form_id', '=', formId).execute()

  let position = 0
  for (const field of input.fields) {
    await db
      .insertInto('form_fields')
      .values({
        // `form_fields` carries no uuid - only `forms` has the useUuid trait.
        form_id: formId,
        name: field.name,
        label: field.label,
        type: field.type,
        required: field.required ?? false,
        position: position++,
        width: field.width ?? 'full',
        options: JSON.stringify(field.options ?? {}),
        conditions: field.conditions ? JSON.stringify(field.conditions) : null,
      })
      .execute()
  }

  return { id: formId, uuid, handle: input.handle, created }
}

/** Load a form by its site-scoped handle, the way app code refers to one. */
export async function loadFormByHandle(siteId: number | null, handle: string): Promise<FormDefinition | null> {
  const row = await db
    .selectFrom('forms')
    .select(['uuid'])
    .where('handle', '=', handle)
    .where('site_id', siteId === null ? 'is' : '=', siteId)
    .executeTakeFirst() as { uuid: string } | undefined

  if (!row)
    return null

  return await loadFormByUuid(String(row.uuid), siteId)
}

/** The field list as `createForm` takes it, for a definition already loaded. */
export function toCreateFields(fields: FormFieldDefinition[]): CreateFormFieldInput[] {
  return fields.map(field => ({
    name: field.name,
    label: field.label,
    type: field.type,
    required: field.required,
    width: field.width,
    options: field.options as Record<string, unknown>,
    conditions: field.conditions as Record<string, unknown> | null,
  }))
}
