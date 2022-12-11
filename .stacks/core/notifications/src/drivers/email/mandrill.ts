import { MandrillProvider } from '@novu/mandrill'
import type { EmailOptions } from '@stacksjs/types'
import { notification } from '@stacksjs/config'
import emailSend from './functions/emailSend'

const env = notification.email.mandrill

const provider = new MandrillProvider({
  apiKey: env.key,
  from: env.from,
})

async function send(options: EmailOptions, css?: string) {
  return emailSend(options, provider, 'Mandrill', css)
}

export { send as Send, send }
