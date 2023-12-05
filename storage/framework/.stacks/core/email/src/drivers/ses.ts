import { SESEmailProvider } from '@novu/ses'
import type { EmailOptions } from 'stacks:types'
import { notification } from 'stacks:config'
import type { ResultAsync } from 'stacks:error-handling'

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
