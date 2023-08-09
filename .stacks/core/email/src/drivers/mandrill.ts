// import { MandrillProvider } from '@novu/mandrill'
// import type { EmailOptions } from '@stacksjs/types'
// import notification from '~/config/notification'
// import type { ResultAsync } from '@stacksjs/error-handling'
// import { send as sendEmail } from '../actions/send'

// const env = notification.email
// const service = notification.email?.drivers.mandrill

// const provider = new MandrillProvider({
//   apiKey: service?.key || '',
//   from: env?.from.address || '',
// })

// async function send(options: EmailOptions, css?: string): Promise<ResultAsync<any, Error>> {
//   return sendEmail(options, provider, 'Mandrill', css)
// }

// export { send as Send, send }
