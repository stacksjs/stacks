// import { MsTeamsProvider } from '@novu/ms-teams'
// import { italic } from 'stacks:cli'
// import type { ChatOptions } from 'stacks:types'
// import { ResultAsync } from 'stacks:error-handling'
// import { notification } from 'stacks:config'

// const env = notification.chat.msTeams

// const provider = new MsTeamsProvider({
//   applicationId: env.appId,
//   clientId: env.clientId,
//   secretKey: env.secret,
// })

// function send(options: ChatOptions) {
//   return ResultAsync.fromPromise(
//     provider.sendMessage(options),
//     () => new Error(`Failed to send message using provider: ${italic('MsTeams')}`),
//   )
// }

// export { send as Send, send }

export {}
