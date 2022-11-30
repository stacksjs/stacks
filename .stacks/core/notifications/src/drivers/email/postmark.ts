import { PostmarkEmailProvider } from '@novu/postmark'
import { italic } from '@stacksjs/cli'
import type { EmailOptions } from '@stacksjs/types'
import { ResultAsync } from '@stacksjs/error-handling'
import { notification } from '@stacksjs/config'

const env = notification.email.postmark

const provider = new PostmarkEmailProvider({
  apiKey: env.key,
})

function send(options: EmailOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('PostMark')}`),
  )
}

export { send as Send, send }
