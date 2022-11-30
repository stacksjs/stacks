import { MandrillProvider } from '@novu/mandrill'
import { italic } from '@stacksjs/cli'
import type { EmailOptions } from '@stacksjs/types'
import { ResultAsync } from '@stacksjs/error-handling'
import { notification } from '@stacksjs/config'

const env = notification.email.mandrill

const provider = new MandrillProvider({
  apiKey: env.key,
  from: env.from,
})

function send(options: EmailOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Mandrill')}`),
  )
}

export { send as Send, send }
