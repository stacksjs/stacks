import { NetCoreProvider } from '@novu/netcore'
import type { EmailOptions } from '@stacksjs/types'
import { notification } from '@stacksjs/config'
import { send as sendEmail } from './actions/send'

const env = notification.email.netcore

const provider = new NetCoreProvider({
  apiKey: env.key,
  from: env.from,
})

async function send(options: EmailOptions, css?: string) {
  return sendEmail(options, provider, 'Netcore', css)
}

export { send as Send, send }
