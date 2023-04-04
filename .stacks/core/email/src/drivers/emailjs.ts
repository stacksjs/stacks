import { EmailJsProvider } from '@novu/emailjs'
import type { EmailOptions } from '@stacksjs/types'
import { notification } from '@stacksjs/config'
import type { ResultAsync } from '@stacksjs/error-handling'
import { send as sendEmail } from '../actions/send'

const env = notification.email.emailjs

const provider = new EmailJsProvider({
  from: env.from,
  host: env.host,
  user: env.user,
  password: env.password,
  port: env.port,
  secure: env.secure,
})

async function send(options: EmailOptions, css?: string): Promise<ResultAsync<any, Error>> {
  return sendEmail(options, provider, 'EmailJS', css)
}

export { send as Send, send }
