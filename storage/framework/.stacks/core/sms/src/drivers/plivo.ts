import { PlivoSmsProvider } from '@novu/plivo'
import { italic } from 'stacks:cli'
import type { SmsOptions } from 'stacks:types'
import { ResultAsync } from 'stacks:error-handling'
import { notification } from 'stacks:config'

const from = notification.sms?.from
const env = notification.sms?.drivers.plivo

const provider = new PlivoSmsProvider({
  accountSid: env?.sid,
  authToken: env?.authToken,
  from: from || '',
})

function send(options: SmsOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Plivo')}`),
  )
}

export { send as Send, send }
