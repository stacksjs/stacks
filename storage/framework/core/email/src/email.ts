import type { Message } from './message'

export class Email implements Message {
  constructor(private message: Message) {
    this.message = message
  }

  public async send() {
    return await this.message.handle()
  }

  public async onError(error: Error) {
    return await this.message.onError(error)
  }
}

export type { Message }

export const email = new Email()

export default Email
