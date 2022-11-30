import { MailjetEmailProvider } from '@novu/mailjet'
import { italic } from '@stacksjs/cli'
import type { EmailOptions } from '@stacksjs/types'
import { ResultAsync } from '@stacksjs/error-handling'
import { notification } from '@stacksjs/config'

const env = notification.email.mailjet

const provider = new MailjetEmailProvider({
  apiKey: env.key,
  apiSecret: env.secret,
  from: env.from,
})

function send(options: EmailOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Mailjet')}`),
  )
}

export { send as Send, send }
