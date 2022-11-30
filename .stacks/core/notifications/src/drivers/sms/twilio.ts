import { TwilioSmsProvider } from '@novu/twilio'
import type { SendMessageSuccessResponse, SmsOptions } from '@stacksjs/types'
import { env } from '@stacksjs/config'

const provider = new TwilioSmsProvider({
  accountSid: env('TWILIO_ACCOUNT_SID', 'test'),
  authToken: env('TWILIO_AUTH_TOKEN', 'test'),
  from: env('TWILIO_FROM_NUMBER', 'test'),
})

async function send(options: SmsOptions): Promise<SendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
