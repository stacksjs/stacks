import { DiscordProvider } from '@novu/discord'
import { italic } from 'src/cli/src'
import type { ChatOptions } from 'src/types/src'
import { ResultAsync } from 'src/error-handling/src'

const provider = new DiscordProvider({})

function send(options: ChatOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Discord')}`),
  )
}

export { send as Send, send }
