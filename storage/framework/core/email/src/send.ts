// import { italic } from '@stacksjs/cli'
// import { ResultAsync } from '@stacksjs/error-handling'
// import type { EmailOptions } from '@stacksjs/types'

// // import { stringify } from 'json5'

// export async function send(
//   options: EmailOptions,
//   provider: any,
//   providerName: string,
// ): Promise<ResultAsync<any, Error>> {
//   // const template = `
//   // <extends src="./src/notifications/src/utils/template.html">
//   //   <block name="template">
//   //     ${options.html}
//   //   </block>
//   // </extends>`

//   // await Maizzle.render(
//   //   template,
//   //   {
//   //     tailwind: {
//   //       // config: stringify(config),
//   //       css,
//   //       maizzle: maizzleConfig,
//   //     },
//   //   },
//   // )
//   //   .then(({ html }: any) => {
//   //     options.html = html
//   //   })
//   //   .catch((error: any) => log.error(`Failed to render email template using provider: ${italic(providerName)}.`, error))

//   return ResultAsync.fromPromise(
//     provider.sendMessage(options),
//     () => new Error(`Failed to send message using provider: ${italic(providerName)}`),
//   )
// }
