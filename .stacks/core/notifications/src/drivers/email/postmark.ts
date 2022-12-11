import { PostmarkEmailProvider } from '@novu/postmark'
import type { EmailOptions } from '@stacksjs/types'
import { notification } from '@stacksjs/config'
import emailSend from './functions/emailSend'

const env = notification.email.postmark

const provider = new PostmarkEmailProvider({
  apiKey: env.key,
  from: env.from,
})

async function send(options: EmailOptions, css?: string) {
  return emailSend(options, provider, 'Postmark', css)
}

export { send as Send, send }
