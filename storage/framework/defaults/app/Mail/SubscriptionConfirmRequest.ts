import { config } from '@stacksjs/config'
import { mail, template } from '@stacksjs/email'
import { url } from '@stacksjs/router'

export interface SubscriptionConfirmRequestOptions {
  to: string
  /** The pending list membership's token (`subscribe()`'s `token`). */
  token: string
}

/** The app's own address, with a scheme, for links in the email. */
function appUrl(): string {
  const raw = String(config.app.url || '').trim().replace(/\/+$/, '')
  if (!raw)
    return ''
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`
}

/**
 * Ask a new subscriber to confirm their address (double opt-in).
 *
 * Sent by the public signup when the list has `double_opt_in` on. The button
 * opens `GET /api/email/confirm?token=…` (ConfirmSubscriptionAction), which
 * confirms the membership and sends the welcome email. Until then campaigns
 * skip the address. Uses `resources/emails/subscription-confirm.stx`, which an
 * app can override like any email template.
 */
export async function sendSubscriptionConfirmRequest(options: SubscriptionConfirmRequestOptions): Promise<void> {
  const appName = config.app.name || 'Stacks'
  const confirmUrl = url('email.confirm', { token: options.token })
  const subject = `Confirm your subscription to ${appName}`

  const { html, text } = await template('subscription-confirm', {
    variables: {
      email: options.to,
      confirmUrl,
      appName,
      appUrl: appUrl(),
      year: new Date().getFullYear(),
    },
    subject,
  })

  await mail.sendOrFail({
    to: [options.to],
    from: {
      name: config.email.from?.name || appName,
      address: config.email.from?.address || 'hello@stacksjs.com',
    },
    subject,
    html,
    text,
  })
}

export default sendSubscriptionConfirmRequest
