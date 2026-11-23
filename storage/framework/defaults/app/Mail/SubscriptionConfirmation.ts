import { config } from '@stacksjs/config'
import { mail, template } from '@stacksjs/email'
import { buildUnsubscribeHeaders } from '@stacksjs/newsletter'
import { url } from '@stacksjs/router'

export interface SubscriptionConfirmationOptions {
  to: string
  /**
   * The unsubscribe token for the link and the List-Unsubscribe headers: the
   * list membership's uuid (`subscribe()`'s `token`), so unsubscribing leaves
   * that list only.
   */
  token?: string
  /** The subscriber's own uuid, the older global token. Used when `token` is not given. */
  subscriberUuid?: string
}

/** The app's own address, with a scheme, for links in the email. */
function appUrl(): string {
  const raw = String(config.app.url || '').trim().replace(/\/+$/, '')
  if (!raw)
    return ''
  return /^https?:\/\//.test(raw) ? raw : `https://${raw}`
}

/**
 * The RFC 8058 `List-Unsubscribe` headers, so the inbox's own unsubscribe
 * button works (POST `/api/email/unsubscribe`). They need an absolute URL;
 * without one the email still goes, with only the link in its body.
 */
function unsubscribeHeaders(unsubscribeUrl: string): Record<string, string> | undefined {
  try {
    return buildUnsubscribeHeaders({ url: unsubscribeUrl })
  }
  catch {
    return undefined
  }
}

/**
 * Send a subscription confirmation email with an unsubscribe link.
 *
 * Uses the `resources/emails/subscription-confirmation.stx` template, and
 * passes it the app's name and address so a template never has to fall back
 * to the framework's.
 */
export async function sendSubscriptionConfirmation(options: SubscriptionConfirmationOptions): Promise<void> {
  const { to } = options
  const unsubscribeToken = options.token || options.subscriberUuid
  if (!unsubscribeToken)
    throw new Error('[mail] sendSubscriptionConfirmation needs a token for the unsubscribe link')

  const appName = config.app.name || 'Stacks'
  const unsubscribeUrl = url('email.unsubscribe', { token: unsubscribeToken })
  const subject = `You are on the ${appName} list`

  const { html, text } = await template('subscription-confirmation', {
    variables: {
      email: to,
      unsubscribeUrl,
      appName,
      appUrl: appUrl(),
      year: new Date().getFullYear(),
    },
    subject,
  })

  await mail.sendOrFail({
    to: [to],
    from: {
      name: config.email.from?.name || appName,
      address: config.email.from?.address || 'hello@stacksjs.com',
    },
    subject,
    html,
    text,
    headers: unsubscribeHeaders(unsubscribeUrl),
  })
}

export default sendSubscriptionConfirmation
