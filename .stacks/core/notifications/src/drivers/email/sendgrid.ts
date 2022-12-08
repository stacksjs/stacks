import { log } from '@stacksjs/logging'
import { SendgridEmailProvider } from '@novu/sendgrid'
import { italic } from '@stacksjs/cli'
import type { EmailOptions } from '@stacksjs/types'
import { ResultAsync } from '@stacksjs/error-handling'
import { notification } from '@stacksjs/config'
import * as Maizzle from '@maizzle/framework'
import tailwindConfig from './tailwind.config.js'

const env = notification.email.sendgrid

const provider = new SendgridEmailProvider({
  apiKey: env.key,
  from: env.from,
  senderName: env.senderName,
})

async function send(options: EmailOptions, css?: string) {
  const template = `
  <extends src="./core/notifications/src/drivers/email/template.html">
    <block name="template">
      ${options.html}
    </block>
  </extends>`

  await Maizzle.render(
    template,
    {
      tailwind: {
        config: tailwindConfig,
        css,
      },
    },
  )
    .then(({ html }: any) => {
      options.html = html
    })
    .catch((error: any) => log.error(`Failed to render email template using provider: ${italic('Sendgrid')}`, error))

  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Sendgrid')}`),
  )
}

export { send as Send, send }
