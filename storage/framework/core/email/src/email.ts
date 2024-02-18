import { useCompiler } from 'vue-email'
import type { Message, SendEmailParams } from './types'

export class Email implements Message {
  constructor(private message: Message) {
    this.message = message
  }

  public async send() {
    try {
      const template = await useCompiler(this.message.template)
      const params: SendEmailParams = {
        Source: this.message.from,
        Destination: {
          ToAddresses: [this.message.to],
        },
        Message: {
          Body: {
            Html: {
              Charset: 'UTF-8',
              Data: template,
            },
          },
          Subject: {
            Charset: 'UTF-8',
            Data: this.message.subject,
          },
        },
      }

      await ses.sendEmail(params)

      const returnMsg = await this.message.handle()

      await this.onSuccess()

      return returnMsg
    }
    catch (error) {
      return this.onError(error)
    }
  }

  public async onError(error: Error) {
    return await this.message.onError(error)
  }

  public onSuccess() {
    try {
      this.message.onSuccess()
    }
    catch (error) {
      return this.onError(error)
    }
  }
}

export type { Message }

export const email = new Email()

export default Email
