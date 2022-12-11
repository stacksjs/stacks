import { MailjetEmailProvider } from '@novu/mailjet'
import type { EmailOptions } from '@stacksjs/types'
import { notification } from '@stacksjs/config'
import emailSend from './functions/emailSend'

const env = notification.email.mailjet

const provider = new MailjetEmailProvider({
  apiKey: env.key,
  apiSecret: env.secret,
  from: env.from,
})

async function send(options: EmailOptions, css?: string) {
  return emailSend(options, provider, 'Mailjet', css)
}

export { send as Send, send }
