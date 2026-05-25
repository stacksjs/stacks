/**
 * Email webhook event dedup (stacksjs/stacks#1881).
 *
 * Providers (SES, Mailgun, Postmark, SendGrid) retry their webhooks
 * aggressively — a slow response or a transient 500 buys another
 * delivery attempt, sometimes within seconds. Without dedup the
 * framework would record the same bounce twice, double-suppress an
 * address, or double-fire the framework events that listeners
 * react to (analytics, retry-policy updates, etc.).
 *
 * Fix: insert-or-skip into `email_webhook_events` keyed on
 * `(provider, event_id)`. Same opt-in pattern as
 * `stripe_webhook_events` (#1879 Co-17), `order_idempotency`
 * (#1879 Co-3), `email_idempotency` (#1871 M-8),
 * `job_idempotency` (#1872 Q-8).
 *
 * Schema (opt-in; provision via the framework migration):
 *
 *   - `provider`     TEXT NOT NULL  ('mailgun' | 'postmark' | 'ses' | 'sendgrid')
 *   - `event_id`     TEXT NOT NULL
 *   - `processed_at` TEXT NOT NULL
 *   - UNIQUE(provider, event_id)
 */

import { db } from '@stacksjs/database'

let warnedAboutMissingTable = false

function warnOnceAboutMissingTable(): void {
  if (warnedAboutMissingTable) return
  warnedAboutMissingTable = true
  // eslint-disable-next-line no-console
  console.warn(
    '[email/webhook-dedup] email_webhook_events table missing — webhook idempotency NOT enforced. '
    + 'Providers may double-deliver retries; run migrations to enable dedup.',
  )
}

function isMissingTableError(err: unknown): boolean {
  const msg = (err as { message?: string } | null)?.message ?? ''
  return msg.includes('no such table') || msg.includes("doesn't exist")
}

/**
 * Record an event-id as processed. Returns `true` if this is the
 * first time we've seen the id (caller should process), `false`
 * if it's a duplicate (caller should ack-and-skip).
 *
 * When the table doesn't exist, falls through to "always first" +
 * warn-once — apps without the migration still work; they just
 * double-process if the provider retries.
 */
export async function recordWebhookEventOrSkip(
  provider: 'mailgun' | 'postmark' | 'ses' | 'sendgrid',
  eventId: string,
): Promise<boolean> {
  if (!eventId) return true // Some providers (Mailgun ping tests) send blank ids — process them
  try {
    await (db as any)
      .insertInto('email_webhook_events')
      .values({
        provider,
        event_id: eventId,
        processed_at: new Date().toISOString().slice(0, 19).replace('T', ' '),
      })
      .execute()
    return true
  }
  catch (err) {
    if (isMissingTableError(err)) {
      warnOnceAboutMissingTable()
      return true
    }
    const msg = (err as { message?: string } | null)?.message ?? ''
    // UNIQUE constraint hit = duplicate retry; ack-and-skip
    if (msg.includes('UNIQUE constraint') || msg.includes('Duplicate entry')) return false
    throw err
  }
}
