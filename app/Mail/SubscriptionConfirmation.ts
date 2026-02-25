import { config } from '@stacksjs/config'
import { mail, template } from '@stacksjs/email'
import { url } from '@stacksjs/router'

export interface SubscriptionConfirmationOptions {
  to: string
  subscriberUuid: string
}

/**
 * Send a subscription confirmation email with an unsubscribe link.
 *
 * Uses the `resources/emails/subscription-confirmation.stx` template.
 */
export async function sendSubscriptionConfirmation(options: SubscriptionConfirmationOptions): Promise<void> {
  const { to, subscriberUuid } = options

  const appName = config.app.name || 'Stacks'
  const unsubscribeUrl = url('email.unsubscribe', { token: subscriberUuid })

  const { html, text } = await template('subscription-confirmation', {
    variables: {
      email: to,
      unsubscribeUrl,
    },
    subject: `Welcome to ${appName}!`,
  })

  await mail.send({
    to: [to],
    from: {
      name: config.email.from?.name || appName,
      address: config.email.from?.address || 'hello@stacksjs.com',
    },
    subject: `Welcome to ${appName}!`,
    html,
    text,
  })
}

export default sendSubscriptionConfirmation
