import { env } from '@stacksjs/config'
import { SendgridEmailProvider } from '@novu/sendgrid'
import type { EmailOptions, SendMessageSuccessResponse } from '@stacksjs/types'

const provider = new SendgridEmailProvider({
  apiKey: env('SENDGRID_API_KEY', 'test'),
})

async function send(options: EmailOptions): Promise<SendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
