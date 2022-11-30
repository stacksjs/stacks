import { Sms77SmsProvider } from '@novu/sms77'
import type { SendMessageSuccessResponse, SmsOptions } from '@stacksjs/types'
import { env } from '@stacksjs/config'

const provider = new Sms77SmsProvider({
  apiKey: env('SMS77_API_KEY', 'test'),
  from: env('SMS77_FROM', 'test'),
})

async function send(options: SmsOptions): Promise<SendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
