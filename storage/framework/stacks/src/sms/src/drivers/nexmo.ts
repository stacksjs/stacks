import { NexmoSmsProvider } from '@novu/nexmo'
import { italic } from 'src/cli/src'
import type { SmsOptions } from 'src/types/src'
import { ResultAsync } from 'src/error-handling/src'
import { notification } from 'src/config/src'

const from = notification.sms?.from
const env = notification.sms?.drivers.nexmo

const provider = new NexmoSmsProvider({
  apiKey: env?.key || '',
  apiSecret: env?.secret || '',
  from: from || '',
})

function send(options: SmsOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Nexmo')}`),
  )
}

export { send as Send, send }
