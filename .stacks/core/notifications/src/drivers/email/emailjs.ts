import { EmailJsProvider } from '@novu/emailjs'
import { italic } from '@stacksjs/cli'
import type { EmailOptions } from '@stacksjs/types'
import { ResultAsync } from '@stacksjs/error-handling'
import { notification } from '@stacksjs/config'

const env = notification.email.emailjs

const provider = new EmailJsProvider({
  from: env.from,
  host: env.host,
  user: env.user,
  password: env.password,
  port: env.port,
  secure: env.secure,
})

function send(options: EmailOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('EmailJS')}`),
  )
}

export { send as Send, send }
