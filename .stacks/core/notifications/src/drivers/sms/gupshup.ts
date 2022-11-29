import { GupshupSmsProvider } from '@novu/gupshup'
import type { ISendMessageSuccessResponse, ISmsOptions } from '@novu/stateless'
import { env } from '@stacksjs/utils'

const provider = new GupshupSmsProvider({
  userId: env('GUPSHUP_USER_ID', 'test'),
  password: env('GUPSHUP_PASSWORD', 'test'),
})

async function send(options: ISmsOptions): Promise<ISendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
