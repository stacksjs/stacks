import { TwilioSmsProvider } from '@novu/twilio'
import { italic } from 'stacks:cli'
import type { SmsOptions } from 'stacks:types'
import { ResultAsync } from 'stacks:error-handling'
import { notification } from 'stacks:config'

const from = notification.sms?.from
const env = notification.sms?.drivers.twilio

const provider = new TwilioSmsProvider({
  accountSid: env?.sid,
  authToken: env?.authToken,
  from: from || '',
})

function send(options: SmsOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Twilio')}`),
  )
}

export { send as Send, send }
