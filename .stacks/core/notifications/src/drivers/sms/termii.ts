import { TermiiSmsProvider } from '@novu/termii'
import type { ISendMessageSuccessResponse, ISmsOptions } from '@novu/stateless'
import { env } from '@stacksjs/utils'

const provider = new TermiiSmsProvider({
  apiKey: env('TERMII_API_KEY', 'test'),
  from: env('TERMII_SENDER', 'test'),
})

async function send(options: ISmsOptions): Promise<ISendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
