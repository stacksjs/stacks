/**
 * Email suppression list (stacksjs/stacks#1880, M-9 from #1871).
 *
 * Background: a user who hard-bounces, complains, or explicitly
 * unsubscribes would keep receiving every transactional + broadcast
 * email the app dispatched — the framework had no central
 * suppression mechanism. Compliance-sensitive workloads needed
 * enforcement at the framework level so apps couldn't accidentally
 * miss a send call site.
 *
 * Fix: opt-in `email_suppressions` dedup table consulted before
 * `mail.send()` dispatches to the driver. Hit = short-circuit with
 * a structured failure; miss = proceed.
 *
 * Mirrors the dedup-table patterns shipped across the framework
 * (`order_idempotency`, `email_idempotency`, `job_idempotency`,
 * `stripe_webhook_events`) — same insert-or-skip semantics, same
 * warn-once-and-degrade behavior when the table doesn't exist so
 * apps that haven't run the migration aren't broken by the new
 * behavior.
 *
 * Schema (provision via the framework migration that introduces
 * the `email_suppressions` table):
 *
 *   - `email`      TEXT NOT NULL
 *   - `type`       TEXT NOT NULL  ('bounce' | 'complaint' | 'unsubscribe' | 'manual')
 *   - `reason`     TEXT NULL      free-form diagnostic
 *   - `created_at` TEXT NOT NULL
 *   - UNIQUE(email, type)
 */

import { db } from '@stacksjs/database'

export type SuppressionType = 'bounce' | 'complaint' | 'unsubscribe' | 'manual'

export interface SuppressionRecord {
  email: string
  type: SuppressionType
  reason: string | null
  created_at: string
}

let warnedAboutMissingTable = false

function warnOnceAboutMissingTable(): void {
  if (warnedAboutMissingTable) return
  warnedAboutMissingTable = true
  // eslint-disable-next-line no-console
  console.warn(
    '[email/suppression] email_suppressions table missing — suppression checks accepted but NOT enforced. '
    + 'Run migrations to enable enforcement.',
  )
}

/**
 * Does this error mean the backing table simply hasn't been migrated yet?
 * Exported for direct unit coverage across dialects.
 *
 * Each supported database phrases "missing table" differently, and the
 * suppression layer is fail-open — so a matcher that only knows sqlite/mysql
 * would let Postgres's wording slip through and hard-fail every send on an
 * un-migrated Postgres DB (stacksjs/stacks#1976). We scope the Postgres check
 * to `undefined_table` specifically (SQLSTATE 42P01 / `relation "..." does not
 * exist`) rather than a bare `does not exist`, so a genuine `column ... does
 * not exist` schema bug still surfaces instead of being silently swallowed.
 */
export function isMissingTableError(err: unknown): boolean {
  const e = err as { message?: string, code?: string } | null
  const msg = e?.message ?? ''
  return e?.code === '42P01' // postgres SQLSTATE: undefined_table
    || msg.includes('no such table') // sqlite
    || msg.includes("doesn't exist") // mysql: Table '...' doesn't exist
    || /relation "[^"]*" does not exist/i.test(msg) // postgres wording
}

/**
 * The suppression list is a best-effort compliance safeguard, not a hard
 * dependency of sending. When its backing store is simply unavailable — the
 * DB connection dropped, the file can't be opened, no database is configured —
 * we must NOT let that take down every outbound email. Treat those the same
 * way as a missing table: warn once, then proceed (fail-open).
 */
function isSuppressionStoreUnavailable(err: unknown): boolean {
  if (isMissingTableError(err))
    return true
  const msg = ((err as { message?: string } | null)?.message ?? '').toLowerCase()
  return msg.includes('connection closed')
    || msg.includes('unable to open database')
    || msg.includes('econnrefused')
    || msg.includes('connection terminated')
    || msg.includes('no database')
    || msg.includes('database connection')
}

/**
 * Normalize an email address for comparison. Lowercases + trims —
 * matches the canonicalization most providers do. Doesn't apply
 * provider-specific tricks (Gmail's `+`-tag stripping, dot-folding)
 * because those vary by provider and a suppression for `a+1@gmail`
 * shouldn't bleed into `a+2@gmail`.
 */
function canonicalize(email: string): string {
  return String(email).trim().toLowerCase()
}

/**
 * Is the address suppressed? Pass a specific `type` to check only
 * one kind (e.g. unsubscribe-only — bounces from the same address
 * don't count). Omit to match any suppression.
 *
 * Returns `false` when the table doesn't exist yet — apps that
 * haven't run the migration aren't broken by the new behavior, and
 * a one-shot warn lets the operator know the table is missing.
 */
export async function isSuppressed(email: string, type?: SuppressionType): Promise<boolean> {
  const canon = canonicalize(email)
  try {
    let query = (db as any)
      .selectFrom('email_suppressions')
      .where('email', '=', canon)
      .select(['email'])
    if (type) query = query.where('type', '=', type)
    const row = await query.executeTakeFirst()
    return Boolean(row)
  }
  catch (err) {
    if (isSuppressionStoreUnavailable(err)) {
      warnOnceAboutMissingTable()
      return false
    }
    throw err
  }
}

/**
 * Look up the full suppression record(s) for an address — useful
 * for admin tools that want to show the reason/timestamp alongside
 * the suppression status. Returns an empty array on missing-table
 * (same warn-once degrade).
 */
export async function getSuppressions(email: string): Promise<SuppressionRecord[]> {
  const canon = canonicalize(email)
  try {
    const rows = await (db as any)
      .selectFrom('email_suppressions')
      .where('email', '=', canon)
      .selectAll()
      .execute() as SuppressionRecord[]
    return rows ?? []
  }
  catch (err) {
    if (isSuppressionStoreUnavailable(err)) {
      warnOnceAboutMissingTable()
      return []
    }
    throw err
  }
}

/**
 * Record a suppression. Idempotent — a duplicate (email, type)
 * pair silently no-ops (the unique constraint catches it).
 *
 * Called by:
 *   - the framework's bounce/complaint webhook handlers (#1881)
 *   - the unsubscribe route handler (this PR)
 *   - admin tooling (`SuppressionType: 'manual'`)
 */
export async function suppress(
  email: string,
  type: SuppressionType,
  reason?: string,
): Promise<void> {
  const canon = canonicalize(email)
  const createdAt = new Date().toISOString().slice(0, 19).replace('T', ' ')

  try {
    await (db as any)
      .insertInto('email_suppressions')
      .values({
        email: canon,
        type,
        reason: reason ?? null,
        created_at: createdAt,
      })
      .execute()
  }
  catch (err) {
    if (isSuppressionStoreUnavailable(err)) {
      warnOnceAboutMissingTable()
      return
    }
    const msg = (err as { message?: string } | null)?.message ?? ''
    // Idempotent — duplicate (email, type) is fine, that's the point of suppression
    if (msg.includes('UNIQUE constraint') || msg.includes('Duplicate entry')) return
    throw err
  }
}

/**
 * Remove a suppression record (admin recovery, user-initiated
 * resubscribe). Idempotent — removing something that isn't there
 * is a no-op.
 */
export async function unsuppress(email: string, type: SuppressionType): Promise<void> {
  const canon = canonicalize(email)
  try {
    await (db as any)
      .deleteFrom('email_suppressions')
      .where('email', '=', canon)
      .where('type', '=', type)
      .execute()
  }
  catch (err) {
    if (isSuppressionStoreUnavailable(err)) {
      warnOnceAboutMissingTable()
      return
    }
    throw err
  }
}

/**
 * Suppression-policy resolution for `mail.send()` (stacksjs/stacks#1880).
 *
 * Reads the policy from `config.email.suppressionPolicy` with a
 * sensible default and decides whether the message should be
 * allowed through given its tag.
 *
 * Policy semantics:
 *   - `'strict'`                  — block all sends to suppressed addresses
 *   - `'transactional-allowed'`   — block broadcasts; allow `tag: 'transactional'`
 *   - `'off'`                     — never block (table is only used for tracking)
 *
 * Default is `'strict'` — the safest behavior for compliance, and
 * apps that don't run the migration are unaffected because the
 * lookup falls through to "not suppressed" when the table is
 * missing.
 */
export type SuppressionPolicy = 'strict' | 'transactional-allowed' | 'off'

export async function getSuppressionPolicy(): Promise<SuppressionPolicy> {
  try {
    const { config } = await import('@stacksjs/config')
    const policy = (config as { email?: { suppressionPolicy?: SuppressionPolicy } } | undefined)?.email?.suppressionPolicy
    if (policy === 'strict' || policy === 'transactional-allowed' || policy === 'off')
      return policy
  }
  catch {
    // Config not available — fall through to default.
  }
  return 'strict'
}

/**
 * Decide whether a `mail.send()` should proceed for a given
 * recipient. Returns `null` to indicate "allowed"; otherwise
 * returns the matched suppression type so the caller can surface
 * it in the error message.
 *
 * Called from `Mail.send()` after idempotency lookup, before the
 * driver dispatch.
 */
export async function checkSuppressionFor(
  email: string,
  tag: 'transactional' | 'broadcast' | undefined,
): Promise<SuppressionType | null> {
  const policy = await getSuppressionPolicy()
  if (policy === 'off') return null
  if (policy === 'transactional-allowed' && tag === 'transactional') return null

  const suppressions = await getSuppressions(email)
  if (suppressions.length === 0) return null
  // Prefer the most specific signal — unsubscribe > complaint > bounce > manual.
  const priority: SuppressionType[] = ['unsubscribe', 'complaint', 'bounce', 'manual']
  for (const p of priority) {
    if (suppressions.some(s => s.type === p)) return p
  }
  return suppressions[0]!.type
}
