import { SESEmailProvider } from '@novu/ses'
import type { EmailOptions } from '@stacksjs/types'
import { notification } from '@stacksjs/config'
import type { ResultAsync } from '@stacksjs/error-handling'
import { send as sendEmail } from '../send'

const env = notification.email.ses

const provider = new SESEmailProvider({
  region: env.region,
  accessKeyId: env.key,
  secretAccessKey: env.secret,
  from: env.from,
})

async function send(options: EmailOptions, css?: string): Promise<ResultAsync<any, Error>> {
  // return sendEmail(options, provider, 'Ses', css)
}

export { send as Send, send }

export {}
