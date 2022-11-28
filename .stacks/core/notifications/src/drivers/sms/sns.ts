import { SNSSmsProvider } from '@novu/sns'
import type { ISendMessageSuccessResponse, ISmsOptions } from '@novu/stateless'
import { env } from '@stacksjs/utils'

const provider = new SNSSmsProvider({
  region: env('SNS_REGION', 'test'),
  accessKeyId: env('SNS_ACCESS_KEY_ID', 'test'),
  secretAccessKey: env('SNS_SECRET_ACCESS_KEY', 'test'),
})

async function send(options: ISmsOptions): Promise<ISendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
