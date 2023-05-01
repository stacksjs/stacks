import { PlivoSmsProvider } from '@novu/plivo'
import { italic } from '@stacksjs/cli'
import type { SmsOptions } from '@stacksjs/types'
import { ResultAsync } from '@stacksjs/error-handling'
import { notification } from '@stacksjs/config/user'

const env = notification.sms?.plivo

const provider = new PlivoSmsProvider({
  accountSid: env?.sid,
  authToken: env?.authToken,
  from: env?.from,
})

function send(options: SmsOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Plivo')}`),
  )
}

export { send as Send, send }
