import { PlivoSmsProvider } from '@novu/plivo'
import type { SendMessageSuccessResponse, SmsOptions } from '@stacksjs/types'
import { env } from '@stacksjs/utils'

const provider = new PlivoSmsProvider({
  accountSid: env('PLIVO_ACCOUNT_ID', 'test'),
  authToken: env('PLIVO_AUTH_TOKEN', 'test'),
  from: env('PLIVO_FROM_NUMBER', 'test'),
})

async function send(options: SmsOptions): Promise<SendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
