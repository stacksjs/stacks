// import { TwilioSmsProvider } from '@novu/twilio'
// import { italic } from '@stacksjs/cli'
// import type { SmsOptions } from '@stacksjs/types'
// import { ResultAsync } from '@stacksjs/error-handling'
// import { notification } from '@stacksjs/config'

// const from = notification.sms?.from
// const env = notification.sms?.drivers.twilio

// const provider = new TwilioSmsProvider({
//   accountSid: env?.sid,
//   authToken: env?.authToken,
//   from: from || '',
// })

// function send(options: SmsOptions) {
//   return ResultAsync.fromPromise(
//     provider.sendMessage(options),
//     () => new Error(`Failed to send message using provider: ${italic('Twilio')}`),
//   )
// }

// export { send as Send, send }
