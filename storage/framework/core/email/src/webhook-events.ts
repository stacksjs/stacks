/**
 * Email-side event-bus emitters (stacksjs/stacks#1881).
 *
 * Thin wrappers around `@stacksjs/events` `dispatch()` so the
 * webhook handlers stay focused on signature + dedup + classification.
 * Subscribers (analytics, suppression-list maintenance, alerting)
 * register against the typed event names below.
 *
 * Lazy-imports the events package so the email package stays usable
 * in CLI / migration contexts that don't pull the events bus.
 * Mirrors the pattern from commerce/orders/events.ts.
 */

import type { SuppressionType } from './suppression'

export type EmailBounceType = 'hard' | 'soft'
export type EmailEventClassification = 'bounce-hard' | 'bounce-soft' | 'complaint' | 'unsubscribe' | 'delivered'

/**
 * Payload shape every email-event listener receives. Always
 * includes the recipient + provider + the provider's raw event
 * payload so listeners can branch on provider-specific fields
 * without re-parsing.
 */
export interface EmailEventPayload {
  email: string
  provider: 'mailgun' | 'postmark' | 'ses' | 'sendgrid'
  reason?: string
  raw: unknown
}

async function emit(event: string, payload: EmailEventPayload): Promise<void> {
  try {
    const mod = await import('@stacksjs/events').catch(() => null)
    if (!mod) return
    const dispatch = (mod as { dispatch?: (t: string, p: unknown) => void }).dispatch
    if (typeof dispatch !== 'function') return
    dispatch(event, payload)
  }
  catch {
    // Notification side-channel — never propagate failures back
    // through the webhook response (the provider would retry, and
    // we already either suppressed-or-not'd against the database).
  }
}

/** Fired when a provider reports a hard bounce. */
export async function emitEmailBounceHard(payload: EmailEventPayload): Promise<void> {
  await emit('email:bounce-hard', payload)
  await emit('email:bounce', payload) // also fire the umbrella event
}

/** Fired when a provider reports a soft bounce (transient). */
export async function emitEmailBounceSoft(payload: EmailEventPayload): Promise<void> {
  await emit('email:bounce-soft', payload)
  await emit('email:bounce', payload)
}

/** Fired when a provider reports a complaint (user marked spam). */
export async function emitEmailComplaint(payload: EmailEventPayload): Promise<void> {
  await emit('email:complaint', payload)
}

/**
 * Fired when the user clicks the framework's signed unsubscribe URL
 * AND when a provider's "unsubscribed" webhook event arrives. Both
 * sources land in the same listener so apps only have to wire up
 * one code path.
 */
export async function emitEmailUnsubscribe(payload: EmailEventPayload): Promise<void> {
  await emit('email:unsubscribe', payload)
}

/**
 * Map a classified event to the suppression type that should be
 * recorded. Soft bounces are intentionally NOT auto-suppressed —
 * they're transient and the next send is likely to succeed.
 */
export function suppressionTypeFor(classification: EmailEventClassification): SuppressionType | null {
  switch (classification) {
    case 'bounce-hard': return 'bounce'
    case 'complaint': return 'complaint'
    case 'unsubscribe': return 'unsubscribe'
    default: return null
  }
}
