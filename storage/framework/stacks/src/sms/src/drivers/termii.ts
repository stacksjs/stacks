import { TermiiSmsProvider } from '@novu/termii'
import { italic } from 'src/cli/src'
import type { SmsOptions } from 'src/types/src'
import { ResultAsync } from 'src/error-handling/src'
import { notification } from 'src/config/src'

const from = notification.sms?.from
const env = notification.sms?.drivers.termii

const provider = new TermiiSmsProvider({
  apiKey: env?.key,
  from: from || '',
})

function send(options: SmsOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Termii')}`),
  )
}

export { send as Send, send }
