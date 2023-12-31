import { MailjetEmailProvider } from '@novu/mailjet'
import type { EmailOptions } from 'src/types/src'
import type { ResultAsync } from 'src/error-handling/src'
import { notification } from 'src/config/src'
import { send as sendEmail } from '../send'

const env = notification.email
const service = notification.email?.drivers.mailjet

const provider = new MailjetEmailProvider({
  apiKey: service?.key || '',
  apiSecret: service?.secret || '',
  from: env?.from.address || '',
  senderName: env?.from.name || '', // look into what exactly this stands for
})

async function send(options: EmailOptions, css?: string): Promise<ResultAsync<any, Error>> {
  return sendEmail(options, provider, 'Mailjet', css)
}

export { send as Send, send }
