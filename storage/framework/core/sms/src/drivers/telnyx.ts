// import { TelnyxSmsProvider } from '@novu/telnyx'
// import { italic } from '@stacksjs/cli'
// import type { SmsOptions } from '@stacksjs/types'
// import { ResultAsync } from '@stacksjs/error-handling'
// import { notification } from '@stacksjs/config'

// const from = notification.sms?.from
// const env = notification.sms?.drivers.telnyx

// const provider = new TelnyxSmsProvider({
//   apiKey: env?.key,
//   messageProfileId: env?.messageProfileId,
//   from: from || '',
// })

// function send(options: SmsOptions) {
//   return ResultAsync.fromPromise(
//     provider.sendMessage(options),
//     () => new Error(`Failed to send message using provider: ${italic('Telnyx')}`),
//   )
// }

// export { send as Send, send }
