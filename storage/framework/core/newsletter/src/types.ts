/**
 * Public types for the @stacksjs/newsletter package.
 *
 * The shapes here describe the *facade input/output*, not the underlying
 * model rows — that lets us keep the public API stable even as model
 * attribute lists evolve.
 */

export type EmailListStatus = 'active' | 'inactive' | 'archived'

export type CampaignStatus
  = | 'draft'
    | 'scheduled'
    | 'sending'
    | 'sent'
    | 'paused'
    | 'cancelled'
    | 'failed'

export type SubscriptionStatus
  = | 'subscribed'
    | 'unsubscribed'
    | 'pending'
    | 'bounced'

export type CampaignSendStatus
  = | 'queued'
    | 'sent'
    | 'failed'
    | 'bounced'
    | 'complained'

export interface CreateListInput {
  name: string
  slug?: string
  description?: string
  doubleOptIn?: boolean
  isPublic?: boolean
}

export interface CreateCampaignInput {
  /** Display name (used in the dashboard). */
  name: string
  /** Email subject line — what the recipient sees. */
  subject: string
  /** Template name (resolved by @stacksjs/email's template loader) or raw HTML. */
  template: string
  /** Plain-text fallback. Strongly recommended for deliverability. */
  text?: string
  /** Target list. Either pass the numeric id or the slug. */
  emailListId?: number
  emailListSlug?: string
  /** Override the default From: address for this campaign only. */
  fromName?: string
  fromAddress?: string
  /** ISO timestamp; presence flips status to 'scheduled'. */
  scheduledAt?: string
  description?: string
}

export interface SubscribeOptions {
  /** List slug or id. Defaults to the global "default" list. */
  list?: string | number
  source?: string
  /** When true, returns even if the email was already subscribed (idempotent). */
  upsert?: boolean
  /**
   * Refuse a named list whose `is_public` is false, with
   * `NewsletterListUnavailableError`. Set it for anything a visitor can
   * reach, such as the public `/api/email/subscribe` endpoint: a form field
   * must never be enough to join an internal list. The default list is
   * always allowed.
   */
  publicOnly?: boolean
  /**
   * `'list'` honours the list's `double_opt_in`: on such a list a new or
   * returning address is stored as `pending` until it confirms with the link
   * in the confirmation email (see `confirm()`). `'skip'`, the default,
   * subscribes at once whatever the list says, which is what an import or an
   * admin adding someone wants. The public signup endpoint passes `'list'`.
   */
  confirmation?: 'list' | 'skip'
}

export interface SubscribeResult {
  /** True if a new pivot row was created; false if it already existed. */
  created: boolean
  /**
   * True when the address had opted out (of this list, or globally through
   * the legacy unsubscribe link) and this call signed it back up.
   */
  reactivated: boolean
  email: string
  listId: number
  /** The `subscribers` row the membership belongs to. */
  subscriberId: number
  /**
   * True when the membership waits on the address confirming (double opt-in).
   * Send it the confirmation email with `token`; `confirm(token)` completes
   * the subscription.
   */
  pending: boolean
  /** Per-list unsubscribe token — embed in the unsubscribe URL / mailto. */
  token: string
}

export interface ConfirmResult {
  /** False for a token that names no membership, or one that has since unsubscribed. */
  ok: boolean
  email?: string
  listId?: number
  /** True when the membership was already confirmed; nothing changed. */
  alreadyConfirmed?: boolean
}

export interface UnsubscribeResult {
  ok: boolean
  email?: string
  listId?: number
  alreadyUnsubscribed?: boolean
}

export interface SendCampaignOptions {
  /**
   * How many recipients per `mail.send()` batch. Larger = fewer queue jobs,
   * but a single failure poisons the whole chunk.
   */
  chunkSize?: number
  /**
   * Optional dry-run: builds payloads + writes CampaignSend rows but does
   * not actually call the transport. Useful for QA against a real list.
   */
  dryRun?: boolean
}
