import { GupshupSmsProvider } from '@novu/gupshup'
import type { SendMessageSuccessResponse, SmsOptions } from '@stacksjs/types'
import { env } from '@stacksjs/utils'

const provider = new GupshupSmsProvider({
  userId: env('GUPSHUP_USER_ID', 'test'),
  password: env('GUPSHUP_PASSWORD', 'test'),
})

async function send(options: SmsOptions): Promise<SendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
