import { NexmoSmsProvider } from '@novu/nexmo'
import { italic } from '@stacksjs/cli'
import type { SmsOptions } from '@stacksjs/types'
import { ResultAsync } from '@stacksjs/error-handling'
import { notification } from '@stacksjs/config/user'

const env = notification.sms?.nexmo

const provider = new NexmoSmsProvider({
  apiKey: env?.key || '',
  apiSecret: env?.secret || '',
  from: env?.from || '',
})

function send(options: SmsOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Nexmo')}`),
  )
}

export { send as Send, send }
