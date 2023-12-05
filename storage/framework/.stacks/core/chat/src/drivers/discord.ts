import { DiscordProvider } from '@novu/discord'
import { italic } from 'stacks:cli'
import type { ChatOptions } from 'stacks:types'
import { ResultAsync } from 'stacks:error-handling'

const provider = new DiscordProvider({})

function send(options: ChatOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Discord')}`),
  )
}

export { send as Send, send }
