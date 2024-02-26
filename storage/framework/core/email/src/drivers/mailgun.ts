// import { MailgunEmailProvider } from '@novu/mailgun'
// import type { EmailOptions } from '@stacksjs/types'
// import type { ResultAsync } from '@stacksjs/error-handling'
// import { notification } from '@stacksjs/config'
// import { send as sendEmail } from '../send'
//
// const env = notification.email
// const service = notification.email?.drivers.mailgun
//
// const provider = new MailgunEmailProvider({
//   apiKey: service?.key || '',
//   domain: service?.domain || '',
//   username: service?.username || '',
//   from: env?.from.address || '',
// })
//
// async function send(options: EmailOptions, css?: string): Promise<ResultAsync<any, Error>> {
//   return sendEmail(options, provider, 'Mailgun', css)
// }
//
// export { send as Send, send }
