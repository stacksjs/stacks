import { NodemailerProvider } from '@novu/nodemailer'
import type { EmailOptions } from 'src/types/src'
import type { ResultAsync } from 'src/error-handling/src'
import { notification } from 'src/config/src'
import { send as sendEmail } from '../send'

const env = notification.email
const service = notification.email?.drivers.nodemailer

const provider = new NodemailerProvider({
  from: env?.from.address || '',
  host: service?.host || '',
  user: service?.user,
  password: service?.password,
  port: service?.port || 587,
  secure: service?.secure,
})

async function send(options: EmailOptions, css?: string): Promise<ResultAsync<any, Error>> {
  return sendEmail(options, provider, 'Nodemailer', css)
}

export { send as Send, send }
