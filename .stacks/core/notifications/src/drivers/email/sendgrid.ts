import { SendgridEmailProvider } from '@novu/sendgrid'
import { italic } from '@stacksjs/cli'
import type { EmailOptions } from '@stacksjs/types'
import { ResultAsync } from '@stacksjs/error-handling'
import { notification } from '@stacksjs/config'

const env = notification.email.sendgrid

const provider = new SendgridEmailProvider({
  apiKey: env.key,
  from: env.from,
  senderName: env.senderName,
})

function send(options: EmailOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Sendgrid')}`),
  )
}

export { send as Send, send }
