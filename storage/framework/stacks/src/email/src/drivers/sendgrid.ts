import { SendgridEmailProvider } from '@novu/sendgrid'
import type { EmailOptions } from 'src/types/src'
import type { ResultAsync } from 'src/error-handling/src'
import { notification } from '@stacksjs/config'
import { send as sendEmail } from '../send'

const env = notification.email
const service = notification.email?.drivers.sendgrid

const driver = new SendgridEmailProvider({
  apiKey: service?.key || '',
  from: env?.from.address || '',
  senderName: service?.senderName || '',
})

async function send(options: EmailOptions, css?: string): Promise<ResultAsync<any, Error>> {
  return sendEmail(options, driver, 'Sendgrid', css)
}

export { send as Send, send }
