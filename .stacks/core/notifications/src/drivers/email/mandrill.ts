import { MandrillProvider } from '@novu/mandrill'
import { env } from '@stacksjs/utils'
import type { IEmailOptions, ISendMessageSuccessResponse } from '@novu/stateless'

const provider = new MandrillProvider({
  apiKey: env('MANDRILL_API_KEY', 'test'),
  from: env('MANDRILL_EMAIL', 'test'),
})

async function send(options: IEmailOptions): Promise<ISendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
