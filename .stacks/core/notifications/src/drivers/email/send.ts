import { EmailOptions, log, italic, ResultAsync } from "stacks"
import tailwindConfig from "./tailwind.config"
import Maizzle from '@maizzle/framework'

async function send(options: EmailOptions, provider?: any, css?: string) {
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
  
export { send }