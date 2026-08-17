import { model } from './models'
import { subscribe } from './subscriptions'

/**
 * Putting an audience you already have onto a list.
 *
 * `subscribe()` is the right call when a person asks: it even flips a
 * previously-unsubscribed row back on, because someone signing up again means
 * they want back in.
 *
 * A bulk sync is the opposite situation. The input is "every contact in my
 * database", not a request from any of them, so the same behaviour would
 * silently resurrect everyone who had opted out - rude, and in most
 * jurisdictions unlawful. This never revives an unsubscribed row and never
 * adds a suppressed address (a bounce or a spam complaint), and it reports
 * what it skipped so the caller can say so out loud.
 *
 * Idempotent: running it after every enrolment change is the intended use.
 */

export interface SyncContact {
  email: string
  /** Where this contact came from, recorded on new subscriptions. */
  source?: string
}

export interface SyncListResult {
  /** Newly subscribed. */
  added: number
  /** Already on the list and still subscribed. */
  existing: number
  /** On the list but unsubscribed - deliberately left alone. */
  unsubscribed: number
  /** Bounced, complained or otherwise suppressed - not added. */
  suppressed: number
  /** Not a usable email address. */
  invalid: number
  /** The addresses skipped, for a caller that wants to show them. */
  skipped: { unsubscribed: string[], suppressed: string[], invalid: string[] }
}

export function looksLikeEmail(value: string): boolean {
  return Boolean(value) && value.includes('@') && !value.startsWith('@') && !value.endsWith('@')
}

/** What a sync should do with one contact. */
export type SyncDecision = 'add' | 'existing' | 'skip-unsubscribed' | 'skip-suppressed' | 'skip-invalid' | 'skip-duplicate'

export interface SyncContactState {
  /** Already seen in this run - two children can share one parent address. */
  duplicate: boolean
  /** On the email suppression list (bounced, complained, unsubscribed there). */
  suppressed: boolean
  /** The pivot row's status, or null when the address is not on the list. */
  listStatus: string | null
}

/**
 * The decision itself, separated from the reading and writing.
 *
 * All the judgement a sync makes lives here: an address that opted out stays
 * out, a suppressed address is never added back, a repeated address counts
 * once, and anything that is not an address at all is reported rather than
 * attempted.
 */
export function syncDecision(email: string, state: SyncContactState): SyncDecision {
  if (!looksLikeEmail(email))
    return 'skip-invalid'

  if (state.duplicate)
    return 'skip-duplicate'

  if (state.suppressed)
    return 'skip-suppressed'

  // The one that matters: `subscribe()` would flip this back on, because it
  // assumes the person asked. A sync has no such request behind it.
  if (state.listStatus === 'unsubscribed')
    return 'skip-unsubscribed'

  return state.listStatus === 'subscribed' ? 'existing' : 'add'
}

export async function syncListSubscribers(
  list: string | number,
  contacts: readonly SyncContact[],
  options: { source?: string } = {},
): Promise<SyncListResult> {
  const [EmailListSubscriber, Subscriber] = await Promise.all([model('EmailListSubscriber'), model('Subscriber')])

  const result: SyncListResult = {
    added: 0,
    existing: 0,
    unsubscribed: 0,
    suppressed: 0,
    invalid: 0,
    skipped: { unsubscribed: [], suppressed: [], invalid: [] },
  }

  // One address may appear under several contacts (two children, one parent).
  const seen = new Set<string>()

  for (const contact of contacts) {
    const raw = String(contact.email ?? '')
    const email = raw.trim().toLowerCase()

    let listStatus: string | null = null
    if (looksLikeEmail(email) && !seen.has(email)) {
      const subscriber = await Subscriber.where('email', email).first()
      if (subscriber) {
        const pivot = await EmailListSubscriber
          .where('subscriber_id', subscriber.id)
          .where('email_list_id', await resolveId(list))
          .first()
        listStatus = pivot?.status ?? null
      }
    }

    const decision = syncDecision(email, {
      duplicate: seen.has(email),
      suppressed: looksLikeEmail(email) ? await suppressed(email) : false,
      listStatus,
    })

    if (looksLikeEmail(email))
      seen.add(email)

    switch (decision) {
      case 'skip-invalid':
        result.invalid++
        result.skipped.invalid.push(raw)
        continue
      case 'skip-duplicate':
        continue
      case 'skip-suppressed':
        result.suppressed++
        result.skipped.suppressed.push(email)
        continue
      case 'skip-unsubscribed':
        result.unsubscribed++
        result.skipped.unsubscribed.push(email)
        continue
      case 'existing':
        result.existing++
        continue
      case 'add':
        break
    }

    const outcome = await subscribe(email, {
      list,
      source: contact.source ?? options.source ?? 'sync',
      upsert: true,
    })

    if (outcome.created)
      result.added++
    else
      result.existing++
  }

  return result
}

/**
 * Whether an address is suppressed.
 *
 * `@stacksjs/email` is imported lazily and its absence is not fatal: this
 * package does not depend on it (nothing here sends), and an app running the
 * newsletter tables without the email package should still be able to sync a
 * list - it simply has no suppression list to consult.
 */
async function suppressed(email: string): Promise<boolean> {
  try {
    const { isSuppressed } = await import('@stacksjs/email')
    return await isSuppressed(email)
  }
  catch {
    return false
  }
}

/** The list's id, whether it was named by slug or given as one. */
async function resolveId(list: string | number): Promise<number> {
  if (typeof list === 'number')
    return list

  const EmailList = await model('EmailList')
  const row = await EmailList.where('slug', list).first()
  return Number(row?.id ?? 0)
}
