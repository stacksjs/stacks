import { SNSSmsProvider } from '@novu/sns'
import { italic } from 'src/cli/src'
import type { SmsOptions } from 'src/types/src'
import { ResultAsync } from 'src/error-handling/src'
import { notification } from 'src/config/src'

const env = notification.sms?.drivers.sns

const provider = new SNSSmsProvider({
  region: env?.region,
  accessKeyId: env?.key,
  secretAccessKey: env?.secret,
})

function send(options: SmsOptions) {
  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('SNS')}`),
  )
}

export { send as Send, send }
