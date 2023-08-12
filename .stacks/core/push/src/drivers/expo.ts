// import { Novu } from '@novu/node'
// import notification from '~/config/notification'
// import type { ExpoPushNotificationOptions } from '@stacksjs/types'
// import { ResultAsync } from '@stacksjs/error-handling'
// import { italic } from '@stacksjs/cli'

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
