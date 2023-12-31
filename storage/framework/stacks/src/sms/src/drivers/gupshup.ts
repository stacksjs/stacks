import { GupshupSmsProvider } from '@novu/gupshup'
import { italic } from 'src/cli/src'
import type { SmsOptions } from 'src/types/src'
import { ResultAsync } from 'src/error-handling/src'
import { notification } from 'src/config/src'

const env = notification.sms?.drivers.gupshup

const provider = new GupshupSmsProvider({
  userId: env?.user || '',
  password: env?.password || '',
})

function send(options: SmsOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Gupshup')}`),
  )
}

export { send as Send, send }
