import { SESEmailProvider } from '@novu/ses'
import { italic } from '@stacksjs/cli'
import type { EmailOptions } from '@stacksjs/types'
import { ResultAsync } from '@stacksjs/error-handling'
import { notification } from '@stacksjs/config'

const env = notification.email.ses

const provider = new SESEmailProvider({
  region: env.region,
  accessKeyId: env.key,
  secretAccessKey: env.secret,
  from: env.from,
})

function send(options: EmailOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('SES')}`),
  )
}

export { send as Send, send }
