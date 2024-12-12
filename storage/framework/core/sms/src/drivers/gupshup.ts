// import { GupshupSmsProvider } from '@novu/gupshup'
// import { italic } from '@stacksjs/cli'
// import type { SmsOptions } from '@stacksjs/types'
// import { ResultAsync } from '@stacksjs/error-handling'
// import { notification } from '@stacksjs/config'

// const env = notification.sms?.drivers.gupshup

// const provider = new GupshupSmsProvider({
//   userId: env?.user || '',
//   password: env?.password || '',
// })

// function send(options: SmsOptions) {
//   return ResultAsync.fromPromise(
//     provider.sendMessage(options),
//     () => new Error(`Failed to send message using provider: ${italic('Gupshup')}`),
//   )
// }

// export { send as Send, send }
