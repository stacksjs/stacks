/**
 * Default framework email routes (stacksjs/stacks#1880, #1881).
 *
 * Mounts:
 *   - GET  /_stacks/email/unsubscribe/:token   — opt-out via signed link
 *   - POST /webhooks/email/mailgun             — bounce/complaint events
 *   - POST /webhooks/email/postmark            — bounce/complaint events
 *   - POST /webhooks/email/ses                 — SES via SNS
 *   - POST /webhooks/email/sendgrid            — event webhook
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

import { route } from '@stacksjs/router'
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
}

function emailConfig(): EmailConfigShape {
  return ((config as { email?: EmailConfigShape } | undefined)?.email ?? {}) as EmailConfigShape
}

// ============================================================================
// Unsubscribe — signed-link opt-out (stacksjs/stacks#1880)
// ============================================================================

route.get('/_stacks/email/unsubscribe/{token}', async (req) => {
  const params = (req as unknown as { params?: { token?: string } }).params
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
}).skipCsrf()

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
  // Bun's Request exposes the client IP via the server's `requestIP` API,
  // not directly on the request. The framework's enhanced-request layer
  // surfaces it via _clientIp when available; fall back gracefully.
  const sourceIp = (req as unknown as { _clientIp?: string })._clientIp
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
