import { SendgridEmailProvider } from '@novu/sendgrid'
import type { EmailOptions } from '@stacksjs/types'
import { notification } from '@stacksjs/config'
import { send as sendEmail } from '../actions/send'

const env = notification.email.sendgrid

const provider = new SendgridEmailProvider({
  apiKey: env.key,
  from: env.from,
  senderName: env.senderName,
})

async function send(options: EmailOptions, css?: string) {
  return sendEmail(options, provider, 'Sendgrid', css)
}

export { send as Send, send }
