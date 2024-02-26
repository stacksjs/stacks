// import { SNSSmsProvider } from '@novu/sns'
// import { italic } from '@stacksjs/cli'
// import type { SmsOptions } from '@stacksjs/types'
// import { ResultAsync } from '@stacksjs/error-handling'
// import { notification } from '@stacksjs/config'

// const env = notification.sms?.drivers.sns

// const provider = new SNSSmsProvider({
//   region: env?.region,
//   accessKeyId: env?.key,
//   secretAccessKey: env?.secret,
// })

// function send(options: SmsOptions) {
//   return ResultAsync.fromPromise(
//     provider.sendMessage(options),
//     () => new Error(`Failed to send message using provider: ${italic('SNS')}`),
//   )
// }

// export { send as Send, send }
