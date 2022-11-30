import { MandrillProvider } from '@novu/mandrill'
import { env } from '@stacksjs/utils'
import type { EmailOptions, SendMessageSuccessResponse } from '@stacksjs/types'

const provider = new MandrillProvider({
  apiKey: env('MANDRILL_API_KEY', 'test'),
  from: env('MANDRILL_EMAIL', 'test'),
})

async function send(options: EmailOptions): Promise<SendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
