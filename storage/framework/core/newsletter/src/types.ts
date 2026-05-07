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
}

export interface SubscribeResult {
  /** True if a new pivot row was created; false if it already existed. */
  created: boolean
  email: string
  listId: number
  /** Per-list unsubscribe token — embed in the unsubscribe URL / mailto. */
  token: string
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
