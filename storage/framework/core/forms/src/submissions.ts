import type { FormDefinition, SubmissionErrors } from './types'
import { randomUUID } from 'node:crypto'
import { config } from '@stacksjs/config'
import { db, sqlDateTime } from '@stacksjs/database'
import { validateSubmission } from './validate'

export interface SubmitOptions {
  ip?: string
  /** Client-reported ms the form was open; the honeypot's companion. */
  renderedAtMs?: number
  /** The hidden honeypot field's value, if the renderer included one. */
  honeypot?: string
}

export type SubmitResult
  = | { ok: true, submissionId: number, submissionUuid: string, status: 'complete' | 'pending_payment', amountCents: number | null, confirmation: string | null, redirect: string | null }
    | { ok: false, status: 422, errors: SubmissionErrors }
    | { ok: false, status: 404 | 409 | 429, message: string }

/**
 * Accept a public submission. The caller (route/action) has already resolved
 * the form for the request's site via `loadFormByUuid` - this validates,
 * spam-guards, stores, and reports what should happen next (payment or
 * confirmation). Notifications are the caller's follow-up so transports
 * never block the write.
 */
export async function submitForm(form: FormDefinition, payload: Record<string, unknown>, options: SubmitOptions = {}): Promise<SubmitResult> {
  if (form.status !== 'active')
    return { ok: false, status: 409, message: 'This form is not accepting responses.' }

  const spam = (config as { forms?: { spam?: { honeypot?: boolean, minSubmitSeconds?: number } } }).forms?.spam ?? {}

  // Honeypot: a hidden field humans never see. Filled = bot. Answer success
  // so the bot learns nothing, store nothing.
  if ((spam.honeypot ?? true) && typeof options.honeypot === 'string' && options.honeypot.trim() !== '')
    return { ok: true, submissionId: 0, submissionUuid: '', status: 'complete', amountCents: null, confirmation: form.settings.confirmation?.type === 'message' ? form.settings.confirmation.value : null, redirect: null }

  // Faster than a human could read the form = bot.
  const minSeconds = spam.minSubmitSeconds ?? 3
  if (minSeconds > 0 && options.renderedAtMs !== undefined && options.renderedAtMs < minSeconds * 1000)
    return { ok: false, status: 429, message: 'That was submitted too quickly. Please try again.' }

  const validated = validateSubmission(form, payload)
  if (!validated.ok)
    return { ok: false, status: 422, errors: validated.errors }

  const wantsPayment = form.settings.payment && (validated.amountCents ?? 0) > 0
  const status = wantsPayment ? 'pending_payment' : 'complete'
  const uuid = randomUUID()
  const now = sqlDateTime(new Date())

  await db
    .insertInto('form_submissions')
    .values({
      uuid,
      form_id: form.id,
      site_id: form.siteId,
      data: JSON.stringify(validated.values),
      email: validated.email,
      name: validated.name,
      status,
      amount_cents: validated.amountCents,
      ip: options.ip ?? null,
      submitted_at: now,
      created_at: now,
      updated_at: now,
    } as never)
    .execute()

  const row = await db
    .selectFrom('form_submissions')
    .where('uuid', '=', uuid)
    .select(['id'])
    .executeTakeFirst() as { id: number } | undefined

  const confirmation = form.settings.confirmation
  return {
    ok: true,
    submissionId: Number(row?.id ?? 0),
    submissionUuid: uuid,
    status,
    amountCents: validated.amountCents,
    confirmation: confirmation?.type === 'message' ? confirmation.value : null,
    redirect: confirmation?.type === 'redirect' ? confirmation.value : null,
  }
}

/** Flip a paid submission to complete. Called from the payment webhook. */
export async function completeSubmissionPayment(submissionUuid: string, paymentIntentId: string): Promise<boolean> {
  const now = sqlDateTime(new Date())
  const updated = await db
    .updateTable('form_submissions')
    .set({ status: 'complete', payment_intent_id: paymentIntentId, updated_at: now })
    .where('uuid', '=', submissionUuid)
    .where('status', '=', 'pending_payment')
    .execute() as unknown

  const count = typeof updated === 'number' ? updated : Number((updated as { changes?: number })?.changes ?? 0)
  return count > 0
}

export interface SubmissionListRow {
  id: number
  uuid: string
  values: Record<string, unknown>
  email: string | null
  name: string | null
  status: string
  amountCents: number | null
  submittedAt: string | null
}

/** Admin list, newest first. `formId` scoping is the caller's job to have authorized. */
export async function fetchSubmissions(formId: number, options: { limit?: number, offset?: number } = {}): Promise<SubmissionListRow[]> {
  const rows = await db
    .selectFrom('form_submissions')
    .where('form_id', '=', formId)
    .where('status', '!=', 'spam')
    .select(['id', 'uuid', 'data', 'email', 'name', 'status', 'amount_cents', 'submitted_at'])
    .orderBy('id', 'desc')
    .limit(options.limit ?? 100)
    .offset(options.offset ?? 0)
    .execute() as {
    id: number
    uuid: string
    data: string | null
    email: string | null
    name: string | null
    status: string
    amount_cents: number | null
    submitted_at: string | null
  }[]

  return rows.map(row => ({
    id: Number(row.id),
    uuid: row.uuid,
    values: (() => {
      try {
        return row.data ? JSON.parse(row.data) as Record<string, unknown> : {}
      }
      catch {
        return {}
      }
    })(),
    email: row.email,
    name: row.name,
    status: row.status,
    amountCents: row.amount_cents == null ? null : Number(row.amount_cents),
    submittedAt: row.submitted_at,
  }))
}

function csvEscape(value: unknown): string {
  const text = value === undefined || value === null ? '' : String(value)
  // A leading =, +, -, @ would execute as a formula when the export opens in
  // a spreadsheet - the classic CSV-injection trap for anything
  // parent-supplied.
  const defused = /^[=+\-@]/.test(text) ? `'${text}` : text
  return /[",\n\r]/.test(defused) ? `"${defused.replace(/"/g, '""')}"` : defused
}

/** The full submission set as CSV: field columns in position order + the typed columns. */
export async function exportSubmissionsCsv(form: FormDefinition): Promise<string> {
  const fields = form.fields.filter(field => field.type !== 'section_break').sort((a, b) => a.position - b.position)
  const rows = await fetchSubmissions(form.id, { limit: 100000 })

  const header = [...fields.map(field => field.label), 'Email', 'Name', 'Status', 'Amount', 'Submitted at']
  const lines = [header.map(csvEscape).join(',')]

  for (const row of rows) {
    lines.push([
      ...fields.map(field => csvEscape(row.values[field.name])),
      csvEscape(row.email),
      csvEscape(row.name),
      csvEscape(row.status),
      csvEscape(row.amountCents == null ? '' : (row.amountCents / 100).toFixed(2)),
      csvEscape(row.submittedAt),
    ].join(','))
  }

  return lines.join('\n')
}
