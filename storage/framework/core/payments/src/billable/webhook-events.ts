/**
 * Which Stripe webhook events already ran their handlers.
 *
 * Stripe delivers at least once: a slow answer, a dropped connection or a 5xx
 * buys another delivery of the same event (same `evt_...` id), for up to three
 * days. Without a record, `processWebhook` ran every registered handler again
 * on each one, so a retried `invoice.paid` granted a second month or sent a
 * second receipt.
 *
 * The record is written only after every handler succeeded. A handler that
 * throws leaves the event unrecorded, so the provider's retry runs it again
 * instead of being acknowledged and dropped.
 *
 * Rows live in the model-backed `payment_webhook_events` table, the one
 * commerce dedupes its order updates in, under their own provider name so the
 * two paths never skip each other's events: an app can point two Stripe
 * endpoints at the same events, and each must still apply them once.
 */

import { log } from '@stacksjs/logging'
import { db, sqlDateTime } from '@stacksjs/database/runtime'

/** Where handled event ids are remembered. */
export interface WebhookEventStore {
  /** Whether this event id already ran its handlers. */
  has: (eventId: string) => Promise<boolean>
  /** Remember the event id as handled. Called once every handler succeeded. */
  add: (eventId: string) => Promise<void>
}

/** The `provider` value the registry path writes; commerce writes the driver name (`stripe`). */
export const WEBHOOK_HANDLERS_PROVIDER = 'stripe:handlers'

/** Stripe retries for up to three days; remember a little longer than that. */
const DEFAULT_TTL_SECONDS = 4 * 24 * 60 * 60

/**
 * An in-process store with a time to live. What the database store falls back
 * to before `payment_webhook_events` is migrated, and what a test can pass.
 * It forgets on restart and is not shared between processes.
 */
export function memoryWebhookEventStore(options: { ttlSeconds?: number, maxEntries?: number, now?: () => number } = {}): WebhookEventStore {
  const ttl = (options.ttlSeconds ?? DEFAULT_TTL_SECONDS) * 1000
  const maxEntries = options.maxEntries ?? 10_000
  const now = options.now ?? Date.now
  const seen = new Map<string, number>()

  return {
    async has(eventId) {
      const expires = seen.get(eventId)
      if (expires === undefined)
        return false
      if (expires > now())
        return true
      seen.delete(eventId)
      return false
    },
    async add(eventId) {
      seen.delete(eventId)
      seen.set(eventId, now() + ttl)
      // Insertion order is age order, so the first keys are the oldest.
      while (seen.size > maxEntries) {
        const oldest = seen.keys().next().value
        if (oldest === undefined)
          break
        seen.delete(oldest)
      }
    },
  }
}

let warnedAboutMissingTable = false

function warnOnceAboutMissingTable(): void {
  if (warnedAboutMissingTable)
    return
  warnedAboutMissingTable = true
  log.warn('[payments/webhook] payment_webhook_events table missing - replayed webhook events are only deduplicated in this process. Run `buddy migrate` to remember them across restarts.')
}

/**
 * True when the error is "table not migrated yet", in each dialect's words.
 * Scoped to an undefined table so a real column bug still throws.
 */
function isMissingTableError(error: unknown): boolean {
  const e = error as { message?: string, code?: string } | null
  const message = e?.message ?? ''
  return e?.code === '42P01'
    || message.includes('no such table')
    || message.includes('doesn\'t exist')
    || /relation "[^"]*" does not exist/i.test(message)
}

/**
 * The default store: `payment_webhook_events`, falling back to memory (with a
 * warning, once) when the table is not there. Any other database error throws,
 * so `processWebhook` answers non-2xx and the provider retries later rather
 * than an event being applied twice or dropped.
 */
export function databaseWebhookEventStore(provider: string = WEBHOOK_HANDLERS_PROVIDER): WebhookEventStore {
  const fallback = memoryWebhookEventStore()

  return {
    async has(eventId) {
      try {
        const row = await db
          .selectFrom('payment_webhook_events')
          .where('provider', '=', provider)
          .where('event_id', '=', eventId)
          .select(['id'])
          .executeTakeFirst()
        return !!row || await fallback.has(eventId)
      }
      catch (error) {
        if (!isMissingTableError(error))
          throw error
        warnOnceAboutMissingTable()
        return await fallback.has(eventId)
      }
    },
    async add(eventId) {
      // The memory copy first, so a database that fails here still stops an
      // in-process replay.
      await fallback.add(eventId)
      const now = sqlDateTime(new Date())
      try {
        // Unique on (provider, event_id): a concurrent delivery that also
        // finished leaves one row, not an error.
        await db.insertOrIgnore('payment_webhook_events', {
          provider,
          event_id: eventId,
          processed_at: now,
          created_at: now,
          updated_at: now,
        } as never)
      }
      catch (error) {
        if (!isMissingTableError(error))
          throw error
        warnOnceAboutMissingTable()
      }
    },
  }
}

let defaultStore: WebhookEventStore | null = null

/** The store `handleWebhookEvent` uses when none is passed. */
export function webhookEventStore(): WebhookEventStore {
  defaultStore ??= databaseWebhookEventStore()
  return defaultStore
}

/** Replace the default store (a Redis-backed one, say), or pass null to restore the database store. */
export function setWebhookEventStore(store: WebhookEventStore | null): void {
  defaultStore = store
}
