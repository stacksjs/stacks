import { env } from '@stacksjs/utils'
import { SendgridEmailProvider } from '@novu/sendgrid'
import type { IEmailOptions, ISendMessageSuccessResponse } from '@novu/stateless'

const provider = new SendgridEmailProvider({
  apiKey: env('SENDGRID_API_KEY', 'test'),
})

async function send(options: IEmailOptions): Promise<ISendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
