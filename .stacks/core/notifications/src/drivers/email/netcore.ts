import { NetCoreProvider } from '@novu/netcore'
import { italic } from '@stacksjs/cli'
import type { EmailOptions } from '@stacksjs/types'
import { ResultAsync } from '@stacksjs/error-handling'
import { notification } from '@stacksjs/config'

const env = notification.email.netcore

const provider = new NetCoreProvider({
  apiKey: env.key,
  from: env.from,
})

function send(options: EmailOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Netcore')}`),
  )
}

export { send as Send, send }
