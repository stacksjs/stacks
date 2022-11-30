import { PostmarkEmailProvider } from '@novu/postmark'
import { env } from '@stacksjs/utils'
import type { EmailOptions, SendMessageSuccessResponse } from '@stacksjs/types'

const provider = new PostmarkEmailProvider({
  apiKey: env('POSTMARK_API_KEY', 'test'),
})

async function send(options: EmailOptions): Promise<SendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
