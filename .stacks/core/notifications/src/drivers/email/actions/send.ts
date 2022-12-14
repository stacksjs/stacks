import type { EmailOptions } from '@stacksjs/types'
import { italic } from '@stacksjs/cli'
import { log } from '@stacksjs/logging'
import { ResultAsync } from '@stacksjs/error-handling'
import * as Maizzle from '@maizzle/framework'
import * as maizzleConfig from '../../../../dist/config.cjs'
import { config } from '../tailwind.config'

export async function send(options: EmailOptions, provider: any, providerName: string, css?: string) {
  const template = `
  <extends src="./core/notifications/src/utils/template.html">
    <block name="template">
      ${options.html}
    </block>
  </extends>`

  await Maizzle.render(
    template,
    {
      tailwind: {
        config,
        css,
        maizzle: maizzleConfig,
      },
    },
  )
    .then(({ html }: any) => {
      options.html = html
    })
    .catch((error: any) => log.error(`Failed to render email template using provider: ${italic(providerName)}.`, error))

  return ResultAsync.fromPromise(
    provider.sendMessage(options),
    () => new Error(`Failed to send message using provider: ${italic('Sendgrid')}`),
  )
}
