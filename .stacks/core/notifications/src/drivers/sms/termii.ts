import { TermiiSmsProvider } from '@novu/termii'
import type { SendMessageSuccessResponse, SmsOptions } from '@stacksjs/types'
import { env } from '@stacksjs/config'

const provider = new TermiiSmsProvider({
  apiKey: env('TERMII_API_KEY', 'test'),
  from: env('TERMII_SENDER', 'test'),
})

async function send(options: SmsOptions): Promise<SendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
