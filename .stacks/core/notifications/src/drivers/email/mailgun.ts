import { MailgunEmailProvider } from '@novu/mailgun'
import type { EmailOptions } from '@stacksjs/types'
import { notification } from '@stacksjs/config'
import emailSend from './functions/emailSend'

const env = notification.email.mailgun

const provider = new MailgunEmailProvider({
  apiKey: env.key,
  domain: env.domain,
  username: env.username,
  from: env.from,
})

async function send(options: EmailOptions, css?: string) {
  return emailSend(options, provider, 'Mailgun', css)
}

export { send as Send, send }
