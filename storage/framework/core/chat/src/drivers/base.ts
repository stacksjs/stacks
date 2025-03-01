import type { ChatDriver, ChatDriverConfig, ChatMessage, ChatResult, RenderOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'

export abstract class BaseChatDriver implements ChatDriver {
  public abstract name: string
  protected config: Required<ChatDriverConfig>

  constructor(config?: ChatDriverConfig) {
    this.config = {
      maxRetries: config?.maxRetries || 3,
      retryTimeout: config?.retryTimeout || 1000,
      ...config,
    }
  }

  public configure(config: ChatDriverConfig): void {
    this.config = { ...this.config, ...config }
  }

  public abstract send(message: ChatMessage, options?: RenderOptions): Promise<ChatResult>

  /**
   * Validates chat message fields
   */
  protected validateMessage(message: ChatMessage): boolean {
    if (!message.to) {
      throw new Error('Message recipient is required')
    }

    if (!message.content && !message.template) {
      throw new Error('Either message content or template is required')
    }

    return true
  }

  /**
   * Error handler with standard formatting
   */
  protected async handleError(error: unknown, message: ChatMessage): Promise<ChatResult> {
    const err = error instanceof Error ? error : new Error(String(error))

    log.error(`[${this.name}] Message sending failed`, {
      error: err.message,
      stack: err.stack,
      to: message.to,
      subject: message.subject,
    })

    let result: ChatResult = {
      message: `Message sending failed: ${err.message}`,
      success: false,
      provider: this.name,
    }

    if (message.onError) {
      const customResult = message.onError(err)
      const handlerResult = customResult instanceof Promise
        ? await customResult
        : customResult

      result = {
        ...result,
        ...handlerResult,
        success: false,
        provider: this.name,
      }
    }

    return result
  }

  /**
   * Success handler with standard formatting
   */
  protected async handleSuccess(message: ChatMessage, messageId?: string): Promise<ChatResult> {
    let result: ChatResult = {
      message: 'Message sent successfully',
      success: true,
      provider: this.name,
      messageId,
    }

    try {
      if (message.handle) {
        const customResult = message.handle()
        const handlerResult = customResult instanceof Promise
          ? await customResult
          : customResult

        result = {
          ...result,
          ...handlerResult,
          success: true,
          provider: this.name,
          messageId,
        }
      }

      if (message.onSuccess) {
        const successResult = message.onSuccess()
        const handlerResult = successResult instanceof Promise
          ? await successResult
          : successResult

        result = {
          ...result,
          ...handlerResult,
          success: true,
          provider: this.name,
          messageId,
        }
      }
    }
    catch (error) {
      return this.handleError(error, message)
    }

    return result
  }
}
