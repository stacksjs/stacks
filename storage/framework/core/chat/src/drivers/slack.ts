// import type { ChatMessage, ChatOptions, ChatResult } from '@stacksjs/types'
// import { SlackProvider } from '@novu/slack'
// import { config } from '@stacksjs/config'
// import { log } from '@stacksjs/logging'
// import { BaseChatDriver } from './base'

// export class SlackDriver extends BaseChatDriver {
//   public name = 'slack'
//   private provider: SlackProvider

//   constructor() {
//     super()
//     const env = config.services.slack

//     this.provider = new SlackProvider({
//       applicationId: env?.appId ?? '',
//       clientId: env?.clientId ?? '',
//       secretKey: env?.secret ?? '',
//     })
//   }

//   public async send(message: ChatMessage, options?: ChatOptions): Promise<ChatResult> {
//     const logContext = {
//       provider: this.name,
//       to: message.to,
//       subject: message.subject || 'No subject',
//     }

//     log.info('Sending message via Slack...', logContext)

//     try {
//       this.validateMessage(message)

//       const payload = {
//         ...message,
//         ...options,
//       }

//       const response = await this.sendWithRetry(payload)
//       return this.handleSuccess(message, response.id)
//     }
//     catch (error) {
//       return this.handleError(error, message)
//     }
//   }

//   private async sendWithRetry(payload: any, attempt = 1): Promise<any> {
//     try {
//       const response = await this.provider.sendMessage(payload)

//       log.info(`[${this.name}] Message sent successfully`, {
//         attempt,
//         messageId: response.id,
//       })

//       return response
//     }
//     catch (error) {
//       if (attempt < (config.services.slack?.maxRetries ?? 3)) {
//         const retryTimeout = config.services.slack?.retryTimeout ?? 1000
//         log.warn(`[${this.name}] Message send failed, retrying (${attempt}/${config.services.slack?.maxRetries ?? 3})`)
//         await new Promise(resolve => setTimeout(resolve, retryTimeout))
//         return this.sendWithRetry(payload, attempt + 1)
//       }
//       throw error
//     }
//   }
// }

// export default SlackDriver

// export { SlackDriver as Driver }
// export const driver = new SlackDriver()

// export async function send(message: ChatMessage, options?: ChatOptions): Promise<ChatResult> {
//   return driver.send(message, options)
// }
