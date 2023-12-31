import { TelnyxSmsProvider } from '@novu/telnyx'
import { italic } from 'src/cli/src'
import type { SmsOptions } from 'src/types/src'
import { ResultAsync } from 'src/error-handling/src'
import { notification } from 'src/config/src'

const from = notification.sms?.from
const env = notification.sms?.drivers.telnyx

const provider = new TelnyxSmsProvider({
  apiKey: env?.key,
  messageProfileId: env?.messageProfileId,
  from: from || '',
})

function send(options: SmsOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Telnyx')}`),
  )
}

export { send as Send, send }
