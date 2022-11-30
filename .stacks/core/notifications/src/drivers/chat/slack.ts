import { SlackProvider } from '@novu/slack'
import type { ChatOptions, SendMessageSuccessResponse } from '@stacksjs/types'
import { env } from '@stacksjs/config'

const provider = new SlackProvider({
  applicationId: env('SLACK_APPLICATION_ID', 'test'),
  clientID: env('SLACK_CLIENT_ID', 'test'),
  secretKey: env('SLACK_SECRET_KEY', 'test'),
})

async function send(options: ChatOptions): Promise<SendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
