import { MailjetEmailProvider } from '@novu/mailjet'
import type { EmailOptions } from '@stacksjs/types'
import { notification } from '@stacksjs/config'
import type { ResultAsync } from '@stacksjs/error-handling'
import { send as sendEmail } from '../actions/send'

const env = notification.email.mailjet

const provider = new MailjetEmailProvider({
  apiKey: env.key,
  apiSecret: env.secret,
  from: env.from,
})

async function send(options: EmailOptions, css?: string): Promise<ResultAsync<any, Error>> {
  return sendEmail(options, provider, 'Mailjet', css)
}

export { send as Send, send }
