import { PostmarkEmailProvider } from '@novu/postmark'
import { env } from '@stacksjs/utils'
import type { IEmailOptions, ISendMessageSuccessResponse } from '@novu/stateless'

const provider = new PostmarkEmailProvider({
  apiKey: env('POSTMARK_API_KEY', 'test'),
})

async function send(options: IEmailOptions): Promise<ISendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
