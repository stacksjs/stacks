/**
 * Email send idempotency (stacksjs/stacks#1871 M-8).
 *
 * Background: `mail.send(...)` had no dedup. A queued send retries
 * three times by default; a webhook handler that re-fires on
 * transient failures duplicates every message; a user double-
 * clicking the "send invoice" button gets two invoices. Pre-fix
 * the only defense was caller-side bookkeeping, which every
 * application had to reinvent.
 *
 * Fix: callers pass an `idempotencyKey` on `EmailMessage`. Before
 * dispatching to the driver, `mail.send()` consults a dedup side-
 * table — hit means we return the cached `EmailResult` from the
 * first send; miss means we dispatch as normal and then record the
 * result under the key.
 *
 * Mirrors the order-side dedup shipped in #1879 Co-3
 * (`order_idempotency` table) — same insert-or-skip semantics,
 * same warn-once-and-degrade behavior when the table doesn't exist
 * yet so apps that haven't run the migration aren't broken.
 *
 * Schema (provision via the framework migration that introduces
 * the `email_idempotency` table):
 *
 *   - `idempotency_key` TEXT NOT NULL UNIQUE
 *   - `message_id`      TEXT
 *   - `recipient`       TEXT
 *   - `subject`         TEXT
 *   - `provider`        TEXT
 *   - `success`         INTEGER NOT NULL  (0 | 1)
 *   - `created_at`      TEXT NOT NULL
 *
 * Failed sends are NOT recorded — a transient SMTP failure should
 * be retryable, and storing the failure under the key would lock
 * out the retry. Only successful drivers' results get cached.
 */

import type { EmailMessage, EmailResult } from '@stacksjs/types'
import { db } from '@stacksjs/database'

let warnedAboutMissingEmailIdempotencyTable = false

function warnOnceAboutMissingTable(): void {
  if (warnedAboutMissingEmailIdempotencyTable) return
  warnedAboutMissingEmailIdempotencyTable = true
  // eslint-disable-next-line no-console
  console.warn(
    '[email/idempotency] email_idempotency table missing — idempotency keys are accepted but NOT enforced. '
    + 'Run migrations to enable dedup.',
  )
}

function isMissingTableError(err: unknown): boolean {
  const msg = (err as { message?: string } | null)?.message ?? ''
  return msg.includes('no such table') || msg.includes("doesn't exist")
}

/**
 * Look up a cached EmailResult by idempotency key. Returns the
 * reconstructed result when this key has been seen before, `null`
 * when it hasn't. Degrades to "always null" with a startup warn
 * when the `email_idempotency` dedup table isn't migrated yet.
 */
export async function findEmailByIdempotencyKey(key: string): Promise<EmailResult | null> {
  try {
    const row = await (db as any)
      .selectFrom('email_idempotency')
      .where('idempotency_key', '=', key)
      .selectAll()
      .executeTakeFirst()
    if (!row) return null
    return {
      success: Boolean(row.success),
      message: `Idempotent replay — original send recorded ${row.created_at}`,
      provider: String(row.provider ?? 'cache'),
      messageId: row.message_id ?? undefined,
    } satisfies EmailResult
  }
  catch (err) {
    if (isMissingTableError(err)) {
      warnOnceAboutMissingTable()
      return null
    }
    throw err
  }
}

/**
 * Record a successful send under its idempotency key. No-op when
 * the table doesn't exist (warn-once already fired from the lookup
 * path) and when the result reports failure (failed sends shouldn't
 * lock out retries).
 *
 * Collision (same key inserted concurrently) is intentionally
 * swallowed: the row already exists, which is exactly what the
 * lookup will return next time. Throwing here would mask an
 * otherwise successful send.
 */
export async function recordEmailIdempotency(
  key: string,
  message: EmailMessage,
  result: EmailResult,
): Promise<void> {
  if (!result.success) return

  const recipient = Array.isArray(message.to)
    ? message.to.map(t => typeof t === 'string' ? t : (t as { address: string }).address).join(', ')
    : typeof message.to === 'string'
      ? message.to
      : (message.to as { address: string }).address

  try {
    await (db as any)
      .insertInto('email_idempotency')
      .values({
        idempotency_key: key,
        message_id: result.messageId ?? null,
        recipient,
        subject: message.subject,
        provider: result.provider,
        success: 1,
        created_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      })
      .execute()
  }
  catch (err) {
    if (isMissingTableError(err)) {
      warnOnceAboutMissingTable()
      return
    }
    const msg = (err as { message?: string } | null)?.message ?? ''
    // Concurrent retry won the race — the cached row from the other
    // attempt is already correct, so this is a no-op success.
    if (msg.includes('UNIQUE constraint') || msg.includes('Duplicate entry')) return
    throw err
  }
}
