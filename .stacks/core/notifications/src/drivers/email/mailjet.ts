import { MailjetEmailProvider } from '@novu/mailjet'
import { env } from '@stacksjs/utils'
import type { IEmailOptions, ISendMessageSuccessResponse } from '@novu/stateless'

const provider = new MailjetEmailProvider({
  apiKey: env('MAILJET_API_KEY', 'test'),
  apiSecret: env('MAILJET_API_SECRET', 'test'),
  from: env('MAILJET_FROM_EMAIL', 'test'),
})

async function send(options: IEmailOptions): Promise<ISendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
