import type Stripe from 'stripe'
import type { WebhookHandler } from '../billable/webhook'
import { onWebhookEvent } from '../billable/webhook'

/**
 * Connect webhooks arrive on their own endpoint, with their own signing secret
 * (`config.payment.connect.webhookSecret`), and every event carries
 * `event.account` naming the connected account it is about. Verifying them
 * against the account webhook secret fails every signature, and reading them
 * without `event.account` loses the only field that says whose money moved.
 *
 * Dispatch reuses the account-webhook registry, so `processWebhook` handles
 * both endpoints - only the secret differs at the route.
 */

/**
 * Account lifecycle. `updated` is the one that matters: it fires when a
 * merchant finishes onboarding, when Stripe needs more documents, and when an
 * account is restricted. Treat it as "re-read `accountStatus` and store it"
 * rather than trying to diff the payload.
 */
export function onAccount(handlers: {
  updated?: WebhookHandler
  deauthorized?: WebhookHandler
}): void {
  if (handlers.updated) onWebhookEvent('account.updated', handlers.updated)
  if (handlers.deauthorized) onWebhookEvent('account.application.deauthorized', handlers.deauthorized)
}

/**
 * Payout lifecycle for connected accounts. `failed` is the one worth alerting
 * on - a merchant whose bank details are wrong keeps accruing balance while
 * believing they are being paid.
 */
export function onPayout(handlers: {
  created?: WebhookHandler
  paid?: WebhookHandler
  failed?: WebhookHandler
}): void {
  if (handlers.created) onWebhookEvent('payout.created', handlers.created)
  if (handlers.paid) onWebhookEvent('payout.paid', handlers.paid)
  if (handlers.failed) onWebhookEvent('payout.failed', handlers.failed)
}

/**
 * The connected account an event is about, or null when it is a plain
 * platform-account event.
 *
 * Every Connect handler needs this to know which merchant to update, and it is
 * easy to miss because it sits on the event rather than in `data.object`.
 */
export function getConnectedAccountId(event: Stripe.Event): string | null {
  const account = (event as Stripe.Event & { account?: string }).account
  return typeof account === 'string' && account.length > 0 ? account : null
}

export function getAccount(event: Stripe.Event): Stripe.Account | null {
  if (event.type.startsWith('account.') && !event.type.startsWith('account.application.'))
    return event.data.object as Stripe.Account

  return null
}

export function getPayout(event: Stripe.Event): Stripe.Payout | null {
  if (event.type.startsWith('payout.'))
    return event.data.object as Stripe.Payout

  return null
}

export const manageConnectWebhook = {
  onAccount,
  onPayout,
  getAccount,
  getPayout,
  getConnectedAccountId,
}
