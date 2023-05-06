import { MailgunEmailProvider } from '@novu/mailgun'
import type { EmailOptions } from '@stacksjs/types'
import { notification } from '@stacksjs/config/user'
import type { ResultAsync } from '@stacksjs/error-handling'
import { send as sendEmail } from '../actions/send'

const env = notification.email?.mailgun

const provider = new MailgunEmailProvider({
  apiKey: env?.key || '',
  domain: env?.domain || '',
  username: env?.username || '',
  from: env?.from || '',
})

async function send(options: EmailOptions, css?: string): Promise<ResultAsync<any, Error>> {
  return sendEmail(options, provider, 'Mailgun', css)
}

export { send as Send, send }
