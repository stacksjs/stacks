import { Sms77SmsProvider } from '@novu/sms77'
import { italic } from 'stacks:cli'
import type { SmsOptions } from 'stacks:types'
import { ResultAsync } from 'stacks:error-handling'
import { notification } from 'stacks:config'

const from = notification.sms?.from
const env = notification.sms?.drivers.sms77

const provider = new Sms77SmsProvider({
  apiKey: env?.key,
  from,
})

function send(options: SmsOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Sms77')}`),
  )
}

export { send as Send, send }
