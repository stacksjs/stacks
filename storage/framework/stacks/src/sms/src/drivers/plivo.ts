import { PlivoSmsProvider } from '@novu/plivo'
import { italic } from 'src/cli/src'
import type { SmsOptions } from 'src/types/src'
import { ResultAsync } from 'src/error-handling/src'
import { notification } from 'src/config/src'

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
