import { GupshupSmsProvider } from '@novu/gupshup'
import { italic } from 'stacks:cli'
import type { SmsOptions } from 'stacks:types'
import { ResultAsync } from 'stacks:error-handling'
import { notification } from 'stacks:config'

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
