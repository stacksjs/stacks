import type { FormDefinition, FormFieldDefinition, FormFieldType, FormSettings } from './types'
import { db, getDatabaseDialect, isInTransaction, lockRow, readCommittedTransactionOptions } from '@stacksjs/database/runtime'
import { isReservedFieldName } from './field-name'
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

/**
 * Create or update a form and its fields for one site.
 *
 * Fields are REPLACED rather than merged: a form's fields are a single
 * document in every editor that exists, and merging them by name would leave
 * a removed field behind on the next provision.
 */
export async function createForm(siteId: number | null, input: CreateFormInput): Promise<CreatedForm> {
  if (input.fields.some(field => isReservedFieldName(field.name)))
    throw new RangeError('Reserved form field name')
  if (new Set(input.fields.map(field => field.name)).size !== input.fields.length)
    throw new RangeError('Form field names must be unique')
  // A savepoint inherits its parent's snapshot. READ COMMITTED sees the
  // previous lock owner's commit; SERIALIZABLE parents must retry on conflicts.
  const dialect = getDatabaseDialect()
  if (isInTransaction() && dialect === 'mysql')
    throw new Error('createForm must run outside an enclosing MySQL transaction')
  if (isInTransaction() && dialect === 'postgres') {
    const rows = await db.unsafe('SHOW transaction_isolation').execute()
    const isolation = rows[0]?.transaction_isolation
    if (!['readcommitted', 'serializable'].includes(String(isolation).toLowerCase().replace(/[ _-]/g, '')))
      throw new Error('createForm requires read committed or serializable isolation in the outer transaction')
  }
  // A site mutex also protects missing NULL/global identities, which a normal
  // composite unique index cannot. Owned PostgreSQL transactions use fresh
  // statement snapshots so waiting writers read the preceding owner's commit.
  return db.transaction(async (tx) => {
    // MySQL cannot SET TRANSACTION isolation inside the driver's begin
    // callback. A connection-owned site mutex protects missing identities;
    // a locking current read then holds any existing row through commit.
    const siteLock = `stacks_forms_site_${siteId ?? 'global'}`
    if (dialect === 'postgres')
      await tx.unsafe('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [siteLock])
    if (dialect === 'mysql') {
      const [lock] = await tx.unsafe('SELECT GET_LOCK(?, 10) AS acquired', [siteLock])
      if (Number(lock?.acquired) !== 1) throw new Error('Could not acquire form provisioning lock')
    }
    try {
      const existing = await lockRow(tx, 'forms', { site_id: siteId, handle: input.handle })

      const settings = JSON.stringify(input.settings ?? {})
      let formId: number
      let uuid: string
      let created = false

      if (existing) {
        formId = Number(existing.id)
        uuid = String(existing.uuid)
        await tx
          .updateTable('forms')
          .set({ name: input.name, status: input.status ?? 'active', settings })
          .where('id', '=', formId)
          .execute()
      }
      else {
        uuid = crypto.randomUUID()
        await tx
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

        const [row] = await tx
          .selectFrom('forms')
          .where('uuid', '=', uuid)
          .execute()

        if (!row) throw new Error('Created form could not be read')
        formId = Number(row.id)
        created = true
      }

      await tx.deleteFrom('form_fields').where('form_id', '=', formId).execute()

      let position = 0
      for (const field of input.fields) {
        await tx
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
    finally {
      // The next owner uses SELECT FOR UPDATE and waits for our row's commit
      // after this handoff. Nested MySQL calls are rejected above so a parent
      // cannot retain a row lock while trying to acquire this site lock again.
      if (dialect === 'mysql') await tx.unsafe('SELECT RELEASE_LOCK(?)', [siteLock])
    }
  }, { ...readCommittedTransactionOptions(dialect), retries: 5, sqlStates: ['23505'] })
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
