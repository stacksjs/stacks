import { MailgunEmailProvider } from '@novu/mailgun'
import { env } from '@stacksjs/config'
import type { EmailOptions, SendMessageSuccessResponse } from '@stacksjs/types'

const provider = new MailgunEmailProvider({
  apiKey: env('MAILGUN_API_KEY', 'test'),
  domain: env('MAILGUN_DOMAIN', 'test'),
  username: env('MAILGUN_USERNAME', 'test'),
})

async function send(options: EmailOptions): Promise<SendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
