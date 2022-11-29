import { NexmoSmsProvider } from '@novu/nexmo'
import type { ISendMessageSuccessResponse, ISmsOptions } from '@novu/stateless'
import { env } from '@stacksjs/utils'

const provider = new NexmoSmsProvider({
  apiKey: env('VONAGE_API_KEY', 'test'),
  apiSecret: env('VONAGE_API_SECRET', 'test'),
  from: env('VONAGE_FROM_NUMBER', 'test'),
})

async function send(options: ISmsOptions): Promise<ISendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
