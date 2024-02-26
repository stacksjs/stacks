import { SESEmailProvider } from '@novu/ses'
import type { EmailOptions } from '@stacksjs/types'
import { notification } from '@stacksjs/config'
import type { ResultAsync } from '@stacksjs/error-handling'
import { send as sendEmail } from '../send'

const email = notification.email
const env = email?.drivers?.ses

// const provider = new SESEmailProvider({
const provider = new SESEmailProvider({
  region: env?.region || 'us-east-1',
  accessKeyId: env?.key || '',
  secretAccessKey: env?.secret || '',
  senderName: email?.from.name || 'Stacks',
  from: email?.from.address || '',
})

async function send(options: EmailOptions, css?: string): Promise<ResultAsync<any, Error>> {
  return sendEmail(options, provider, 'Ses', css)
}

export { send as Send, send }
