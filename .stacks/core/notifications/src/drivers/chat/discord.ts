import { DiscordProvider } from '@novu/discord'
import type { ChatOptions, SendMessageSuccessResponse } from '@stacksjs/types'

const provider = new DiscordProvider({})

async function send(options: ChatOptions): Promise<SendMessageSuccessResponse> {
  return await provider.sendMessage(options)
}

export { send as Send, send }
