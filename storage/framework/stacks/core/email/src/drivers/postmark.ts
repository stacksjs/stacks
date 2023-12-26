import { PostmarkEmailProvider } from '@novu/postmark'
import type { EmailOptions } from '@stacksjs/types'
import type { ResultAsync } from '@stacksjs/error-handling'
import { notification } from '@stacksjs/config'
import { send as sendEmail } from '../send'

const env = notification.email
const service = notification.email?.drivers.postmark

const provider = new PostmarkEmailProvider({
  apiKey: service?.key || '',
  from: env?.from.address || '',
})

async function send(options: EmailOptions, css?: string): Promise<ResultAsync<any, Error>> {
  return sendEmail(options, provider, 'Postmark', css)
}

export { send as Send, send }
