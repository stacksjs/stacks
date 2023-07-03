// import { Novu } from '@novu/node'
// import { notification } from '@stacksjs/config'
// import type { FCMPushNotificationOptions } from '@stacksjs/types'
// import { ResultAsync } from '@stacksjs/error-handling'
// import { italic } from '@stacksjs/cli'

// const novu = new Novu(notification.novu.key)

// function send(options: FCMPushNotificationOptions) {
//   return ResultAsync.fromPromise(
//     novu.trigger(options.eventName, {
//       to: options.to,
//       payload: options.payload,
//     }),
//     () => new Error(`Failed to send message using provider: ${italic('FCM')}`),
//   )
// }

// export { send as Send, send }

export const fcmWip = 1
