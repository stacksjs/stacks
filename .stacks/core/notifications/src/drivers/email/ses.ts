import { SESEmailProvider } from '@novu/ses'
import type { EmailOptions } from '@stacksjs/types'
import { notification } from '@stacksjs/config'
import emailSend from './functions/emailSend'

const env = notification.email.ses

const provider = new SESEmailProvider({
  region: env.region,
  accessKeyId: env.key,
  secretAccessKey: env.secret,
  from: env.from,
})

async function send(options: EmailOptions, css?: string) {
  return emailSend(options, provider, 'Ses', css)
}

export { send as Send, send }
