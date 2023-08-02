import { type EmailOptions } from '@stacksjs/types'
import { italic, log } from '@stacksjs/cli'
import { ResultAsync } from '@stacksjs/error-handling'

// @ts-expect-error check if types are available
import * as Maizzle from '@maizzle/framework'
import * as maizzleConfig from '../utils/config'
import { config } from '../tailwind.config'

export async function send(options: EmailOptions, provider: any, providerName: string, css?: string): Promise<ResultAsync<any, Error>> {
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
    () => new Error(`Failed to send message using provider: ${italic(providerName)}`),
  )
}
