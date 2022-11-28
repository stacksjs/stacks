import { MailgunEmailProvider } from '@novu/mailgun'
import { env } from '@stacksjs/utils'
import type { IEmailOptions, ISendMessageSuccessResponse } from '@novu/stateless'

const provider = new MailgunEmailProvider({
  apiKey: env('MAILGUN_API_KEY', 'test'),
  domain: env('MAILGUN_DOMAIN', 'test'),
  username: env('MAILGUN_USERNAME', 'test'),
})

async function send(options: IEmailOptions): Promise<ISendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
