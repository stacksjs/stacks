import { TelnyxSmsProvider } from '@novu/telnyx'
import type { SendMessageSuccessResponse, SmsOptions } from '@stacksjs/types'
import { env } from '@stacksjs/utils'

const provider = new TelnyxSmsProvider({
  apiKey: env('TELNYX_API_KEY', 'test'),
  messageProfileId: env('TELNYX_MESSAGE_PROFILE_ID', 'test'),
  from: env('TELNYX_FROM', 'test'),
})

async function send(options: SmsOptions): Promise<SendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
