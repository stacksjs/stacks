import { EmailJsProvider } from '@novu/emailjs'
import type { EmailOptions } from 'stacks:types'
import type { ResultAsync } from 'stacks:error-handling'
import { notification } from 'stacks:config'
import { send as sendEmail } from '../send'

const env = notification.email
const service = notification.email?.drivers.emailjs

const provider = new EmailJsProvider({
  from: env?.from.address || '',
  host: service?.host || '',
  user: service?.user,
  password: service?.password,
  port: service?.port || 587,
  secure: service?.secure,
})

async function send(options: EmailOptions, css?: string): Promise<ResultAsync<any, Error>> {
  return sendEmail(options, provider, 'EmailJS', css)
}

export { send as Send, send }
