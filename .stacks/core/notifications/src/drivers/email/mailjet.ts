import { MailjetEmailProvider } from '@novu/mailjet'
import { env } from '@stacksjs/config'
import type { EmailOptions, SendMessageSuccessResponse } from '@stacksjs/types'

const provider = new MailjetEmailProvider({
  apiKey: env('MAILJET_API_KEY', 'test'),
  apiSecret: env('MAILJET_API_SECRET', 'test'),
  from: env('MAILJET_FROM_EMAIL', 'test'),
})

async function send(options: EmailOptions): Promise<SendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
