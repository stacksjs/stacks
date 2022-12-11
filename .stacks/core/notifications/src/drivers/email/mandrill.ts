import { MandrillProvider } from '@novu/mandrill'
import type { EmailOptions } from '@stacksjs/types'
import { notification } from '@stacksjs/config'
import { send as sendEmail } from './actions/send'

const env = notification.email.mandrill

const provider = new MandrillProvider({
  apiKey: env.key,
  from: env.from,
})

async function send(options: EmailOptions, css?: string) {
  return sendEmail(options, provider, 'Mandrill', css)
}

export { send as Send, send }
