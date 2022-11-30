import { MailgunEmailProvider } from '@novu/mailgun'
import { italic } from '@stacksjs/cli'
import type { EmailOptions } from '@stacksjs/types'
import { ResultAsync } from '@stacksjs/error-handling'
import { notification } from '@stacksjs/config'

const env = notification.email.mailgun

const provider = new MailgunEmailProvider({
  apiKey: env.key,
  domain: env.domain,
  username: env.username,
  from: env.from,
})

function send(options: EmailOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Mailgun')}`),
  )
}

export { send as Send, send }
