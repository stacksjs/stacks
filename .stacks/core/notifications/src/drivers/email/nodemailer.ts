import { NodemailerProvider } from '@novu/nodemailer'
import type { EmailOptions } from '@stacksjs/types'
import { notification } from '@stacksjs/config'
import { send as sendEmail } from './actions/send'

const env = notification.email.nodemailer

const provider = new NodemailerProvider({
  from: env.from,
  host: env.host,
  user: env.user,
  password: env.password,
  port: env.port,
  secure: env.secure,
})

async function send(options: EmailOptions, css?: string) {
  return sendEmail(options, provider, 'Nodemailer', css)
}

export { send as Send, send }
