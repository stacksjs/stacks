// import { Novu } from '@novu/node'
// import notification from '~/config/notification'
// import type { ExpoPushNotificationOptions } from 'stacks:types'
// import { ResultAsync } from 'stacks:error-handling'
// import { italic } from 'stacks:cli'

// const novu = new Novu(notification.novu.key)

// function send(options: ExpoPushNotificationOptions) {
//   return ResultAsync.fromPromise(
//     novu.trigger(options.eventName, {
//       to: options.to,
//       payload: options.payload,
//     }),
//     () => new Error(`Failed to send message using provider: ${italic('Expo')}`),
//   )
// }

// export { send as Send, send }

export const expoWip = 1
