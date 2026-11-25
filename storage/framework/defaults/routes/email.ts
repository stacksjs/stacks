/**
 * Default framework email routes (stacksjs/stacks#1880, #1881).
 *
 * Mounts:
 *   - GET  /_stacks/email/unsubscribe/:token   — opt-out via signed link
 *   - POST /webhooks/email/mailgun             — bounce/complaint events
 *   - POST /webhooks/email/postmark            — bounce/complaint events
 *   - POST /webhooks/email/ses                 — SES via SNS
 *   - POST /webhooks/email/sendgrid            — event webhook
 *   - POST /api/email/subscribe                — the public newsletter signup
 *   - GET  /api/email/confirm                  — the double opt-in link
 *   - GET/POST /api/email/unsubscribe          — a list membership's opt-out
 *
 * All routes are CSRF-exempt (they're called by external providers
 * or anonymous users clicking unsubscribe links). User routes
 * registered first win, so apps that need to mount their own
 * handlers at the same path can override.
 *
 * Each webhook handler self-disables if its provider credentials
 * aren't configured — returns 401 with `missing-config` rather
 * than processing unauthenticated requests.
 */

import { clientAddress, route } from '@stacksjs/router'
import {
  buildUnsubscribeUrl as _ignored, // import-side dep to ensure tree-shake doesn't drop the module
  handleMailgunWebhook,
  handlePostmarkWebhook,
  handleSendgridWebhook,
  handleSesWebhook,
  suppress,
  verifyUnsubscribeToken,
} from '@stacksjs/email'
import { config } from '@stacksjs/config'
import process from 'node:process'

// Touch the import so the bundler keeps it referenced (the helper
// is used by app code; this file ensures the module loads when
// the framework routes register).
void _ignored

interface EmailConfigShape {
  webhooks?: {
    mailgun?: { signingKey?: string }
    postmark?: { username?: string, password?: string, ipAllowlist?: ReadonlyArray<string> }
    ses?: { autoConfirmSubscriptions?: boolean }
    sendgrid?: { publicKeyPem?: string }
  }
  newsletter?: { signup?: boolean }
}

function emailConfig(): EmailConfigShape {
  return ((config as { email?: EmailConfigShape } | undefined)?.email ?? {}) as EmailConfigShape
}

// ============================================================================
// Unsubscribe — signed-link opt-out (stacksjs/stacks#1880)
// ============================================================================

async function unsubscribe(req: unknown): Promise<Response> {
  const params = (req as { params?: { token?: string } }).params
  const token = params?.token ?? ''
  const result = verifyUnsubscribeToken(token)
  if (!result.valid || !result.email) {
    return new Response(
      `Unsubscribe link invalid or expired (${result.reason ?? 'unknown'}).`,
      { status: 410, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    )
  }
  await suppress(result.email, 'unsubscribe', 'user-initiated via signed URL')
  return new Response(
    `You've been unsubscribed. We won't email ${result.email} again.`,
    { status: 200, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
  )
}

// A person clicking the link in the message.
route.get('/_stacks/email/unsubscribe/{token}', unsubscribe).skipCsrf()

// The mail client's own unsubscribe button. `buildListUnsubscribeHeaders`
// sends `List-Unsubscribe-Post: List-Unsubscribe=One-Click`, and RFC 8058 has
// the client POST that body to the same URL. Only GET was mounted, so the
// button Gmail and Apple Mail show next to the sender reached no route and
// nobody was unsubscribed.
route.post('/_stacks/email/unsubscribe/{token}', unsubscribe).skipCsrf()

// ============================================================================
// Provider webhooks (stacksjs/stacks#1881)
// ============================================================================

route.post('/webhooks/email/mailgun', async (req) => {
  const cfg = emailConfig().webhooks?.mailgun
  const signingKey = cfg?.signingKey ?? process.env.MAILGUN_WEBHOOK_SIGNING_KEY ?? ''
  if (!signingKey) {
    return Response.json({ ok: false, reason: 'missing-config' }, { status: 401 })
  }
  const rawBody = await req.text()
  const result = await handleMailgunWebhook(rawBody, { signingKey })
  return Response.json(result.body, { status: result.status })
}).skipCsrf()

route.post('/webhooks/email/postmark', async (req) => {
  const cfg = emailConfig().webhooks?.postmark
  const username = cfg?.username ?? process.env.POSTMARK_WEBHOOK_USERNAME ?? ''
  const password = cfg?.password ?? process.env.POSTMARK_WEBHOOK_PASSWORD ?? ''
  if (!username || !password) {
    return Response.json({ ok: false, reason: 'missing-config' }, { status: 401 })
  }
  const rawBody = await req.text()
  const auth = req.headers.get('authorization')
  // Postmark's address as trusted proxies report it. This read `_clientIp`,
  // which nothing sets, so a configured `ipAllowlist` refused every delivery.
  const sourceIp = clientAddress(req) ?? undefined
  const result = await handlePostmarkWebhook(rawBody, auth, sourceIp, {
    username,
    password,
    ipAllowlist: cfg?.ipAllowlist,
  })
  return Response.json(result.body, { status: result.status })
}).skipCsrf()

route.post('/webhooks/email/ses', async (req) => {
  const cfg = emailConfig().webhooks?.ses ?? {}
  const rawBody = await req.text()
  const result = await handleSesWebhook(rawBody, {
    autoConfirmSubscriptions: cfg.autoConfirmSubscriptions,
  })
  return Response.json(result.body, { status: result.status })
}).skipCsrf()

route.post('/webhooks/email/sendgrid', async (req) => {
  const cfg = emailConfig().webhooks?.sendgrid
  const publicKeyPem = cfg?.publicKeyPem ?? process.env.SENDGRID_WEBHOOK_PUBLIC_KEY ?? ''
  if (!publicKeyPem) {
    return Response.json({ ok: false, reason: 'missing-config' }, { status: 401 })
  }
  const rawBody = await req.text()
  const sig = req.headers.get('x-twilio-email-event-webhook-signature')
  const ts = req.headers.get('x-twilio-email-event-webhook-timestamp')
  const result = await handleSendgridWebhook(rawBody, sig, ts, { publicKeyPem })
  return Response.json(result.body, { status: result.status })
}).skipCsrf()

// ============================================================================
// Newsletter signup
// ============================================================================
//
// These lived in routes/dashboard.ts, so an app without the dashboard mounted
// the signup action (directly, or under its own path) but not the link in the
// double opt-in email or the unsubscribe link in the welcome email: the
// confirmation failed to send ("Route 'email.confirm' is not defined") and
// nobody could leave the list. They belong with the rest of the email routes.

// CSRF is skipped for the same reason the storefront cart routes skip
// it: the storefront's email-subscribe form is rendered in static HTML
// without a CSRF token round-trip, and the abuse case (bots inflating
// the subscriber list) is better handled with the rate limiter — at
// the action layer — than with a token check the form can't satisfy.
//
// `email.newsletter.signup: false` leaves out the signup and its confirmation
// link, for a deployment that takes no signups (an app's self-hosted install,
// say, when only its public site runs the list). The unsubscribe routes stay
// whatever it says: anyone ever emailed must still be able to leave.
if (emailConfig().newsletter?.signup !== false) {
  route.post('/api/email/subscribe', 'Actions/SubscriberEmailAction').name('email.subscribe').skipCsrf()
  // The button in the double opt-in email (lists with `double_opt_in` on).
  route.get('/api/email/confirm', 'Actions/ConfirmSubscriptionAction').name('email.confirm')
}
route.get('/api/email/unsubscribe', 'Actions/UnsubscribeAction').name('email.unsubscribe')
// RFC 8058 one-click endpoint. Mailbox providers (Gmail, Yahoo, Outlook)
// POST here with body `List-Unsubscribe=One-Click` when the user clicks
// the inbox-native unsubscribe affordance — the request never carries a
// CSRF token because the mailbox provider isn't in our session, so skip.
route.post('/api/email/unsubscribe', 'Actions/UnsubscribeAction').name('email.unsubscribe.oneclick').skipCsrf()
