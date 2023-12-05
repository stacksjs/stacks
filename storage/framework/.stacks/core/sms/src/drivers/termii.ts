import { TermiiSmsProvider } from '@novu/termii'
import { italic } from 'stacks:cli'
import type { SmsOptions } from 'stacks:types'
import { ResultAsync } from 'stacks:error-handling'
import { notification } from 'stacks:config'

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
