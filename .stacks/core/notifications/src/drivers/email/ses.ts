import { SESEmailProvider } from '@novu/ses'
import { env } from '@stacksjs/config'
import type { EmailOptions, SendMessageSuccessResponse } from '@stacksjs/types'

const provider = new SESEmailProvider({
  region: env('SES_REGION', 'test'),
  accessKeyId: env('SES_ACCESS_KEY_ID', 'test'),
  secretAccessKey: env('SES_SECRET_ACCESS_KEY', 'test'),
  from: env('SES_FROM', 'test'),
})

async function send(options: EmailOptions): Promise<SendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
