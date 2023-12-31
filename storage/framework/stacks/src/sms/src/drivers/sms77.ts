import { Sms77SmsProvider } from '@novu/sms77'
import { italic } from 'src/cli/src'
import type { SmsOptions } from 'src/types/src'
import { ResultAsync } from 'src/error-handling/src'
import { notification } from 'src/config/src'

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
