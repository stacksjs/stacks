import { SendgridEmailProvider } from '@novu/sendgrid'
import type { EmailOptions } from '@stacksjs/types'
import { notification } from '@stacksjs/config'
import type { ResultAsync } from '@stacksjs/error-handling'
import { send as sendEmail } from '../actions/send'

const config = notification.email.sendgrid

const driver = new SendgridEmailProvider({
  apiKey: config.key,
  from: config.from,
  senderName: config.senderName,
})

async function send(options: EmailOptions, css?: string): Promise<ResultAsync<any, Error>> {
  return sendEmail(options, driver, 'Sendgrid', css)
}

export { send as Send, send }
