// import { Sms77SmsProvider } from '@novu/sms77'
// import { italic } from '@stacksjs/cli'
// import type { SmsOptions } from '@stacksjs/types'
// import { ResultAsync } from '@stacksjs/error-handling'
// import { notification } from '@stacksjs/config'

// const from = notification.sms?.from
// const env = notification.sms?.drivers.sms77

// const provider = new Sms77SmsProvider({
//   apiKey: env?.key,
//   from,
// })

// function send(options: SmsOptions) {
//   return ResultAsync.fromPromise(
//     provider.sendMessage(options),
//     () => new Error(`Failed to send message using provider: ${italic('Sms77')}`),
//   )
// }

// export { send as Send, send }
