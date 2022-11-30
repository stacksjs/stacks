import { EmailJsProvider } from '@novu/emailjs'
import { env } from '@stacksjs/config'
import type { EmailOptions, SendMessageSuccessResponse } from '@stacksjs/types'

const provider = new EmailJsProvider({
  from: env('EMAILJS_FROM_EMAIL', 'test'),
  host: env('EMAILJS_HOST', 'test'),
  user: env('EMAILJS_USERNAME', 'test'),
  password: env('EMAILJS_PASSWORD', 'test'),
  port: env('EMAILJS_PORT', 'test'),
  secure: env('EMAILJS_SECURE', 'test'),
})

async function send(options: EmailOptions): Promise<SendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
