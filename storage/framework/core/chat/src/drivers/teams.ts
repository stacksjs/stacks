import type { ChatMessage, ChatResult, RenderOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { BaseChatDriver } from './base'

export interface TeamsConfig {
  webhookUrl?: string
  maxRetries?: number
  retryTimeout?: number
}

export interface TeamsAdaptiveCard {
  type: 'AdaptiveCard'
  version: string
  body: TeamsCardElement[]
  actions?: TeamsCardAction[]
  $schema?: string
}

export interface TeamsCardElement {
  type: 'TextBlock' | 'Image' | 'Container' | 'ColumnSet' | 'Column' | 'FactSet' | 'ImageSet'
  text?: string
  size?: 'Small' | 'Default' | 'Medium' | 'Large' | 'ExtraLarge'
  weight?: 'Lighter' | 'Default' | 'Bolder'
  color?: 'Default' | 'Dark' | 'Light' | 'Accent' | 'Good' | 'Warning' | 'Attention'
  wrap?: boolean
  url?: string
  altText?: string
  items?: TeamsCardElement[]
  columns?: TeamsCardElement[]
  width?: string
  facts?: Array<{ title: string, value: string }>
  images?: Array<{ type: 'Image', url: string, size?: string }>
}

export interface TeamsCardAction {
  type: 'Action.OpenUrl' | 'Action.Submit' | 'Action.ShowCard'
  title: string
  url?: string
  data?: Record<string, any>
  card?: TeamsAdaptiveCard
}

export interface TeamsMessage {
  type?: 'message'
  summary?: string
  text?: string
  attachments?: Array<{
    contentType: 'application/vnd.microsoft.card.adaptive'
    content: TeamsAdaptiveCard
  }>
}

let config: TeamsConfig = {}

/**
 * Configure Teams with webhook URL
 */
export function configure(options: TeamsConfig): void {
  config = { ...config, ...options }
}

export class TeamsDriver extends BaseChatDriver {
  public name = 'teams'

  constructor(options?: TeamsConfig) {
    super({
      maxRetries: options?.maxRetries ?? 3,
      retryTimeout: options?.retryTimeout ?? 1000,
    })
    if (options) {
      configure(options)
    }
  }

  public async send(message: ChatMessage, options?: RenderOptions): Promise<ChatResult> {
    const logContext = {
      provider: this.name,
      to: message.to,
      subject: message.subject || 'No subject',
    }

    log.info('Sending message via Microsoft Teams...', logContext)

    try {
      this.validateMessage(message)
      return await this.sendWithRetry(message, options)
    }
    catch (error) {
      return this.handleError(error, message)
    }
  }

  private async sendWithRetry(message: ChatMessage, options?: RenderOptions, attempt = 1): Promise<ChatResult> {
    try {
      await this.sendMessage(message, options)
      return this.handleSuccess(message)
    }
    catch (error) {
      if (attempt < this.config.maxRetries) {
        log.warn(`[${this.name}] Message send failed, retrying (${attempt}/${this.config.maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, this.config.retryTimeout))
        return this.sendWithRetry(message, options, attempt + 1)
      }
      throw error
    }
  }

  private async sendMessage(message: ChatMessage, _options?: RenderOptions): Promise<void> {
    const webhookUrl = config.webhookUrl || message.to

    if (!webhookUrl || !webhookUrl.includes('webhook.office.com')) {
      throw new Error('Teams webhook URL not configured or invalid')
    }

    const payload = this.buildPayload(message)

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Teams webhook failed: ${response.status} - ${errorText}`)
    }
  }

  private buildPayload(message: ChatMessage): TeamsMessage {
    // If simple text message, use basic format
    if (!message.subject && !message.template) {
      return {
        type: 'message',
        text: message.content || '',
      }
    }

    // Build Adaptive Card for rich messages
    const card = this.buildAdaptiveCard(message)

    return {
      type: 'message',
      summary: message.subject || message.content?.substring(0, 50) || 'Notification',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: card,
        },
      ],
    }
  }

  private buildAdaptiveCard(message: ChatMessage): TeamsAdaptiveCard {
    const body: TeamsCardElement[] = []

    // Title
    if (message.subject) {
      body.push({
        type: 'TextBlock',
        text: message.subject,
        size: 'Large',
        weight: 'Bolder',
        wrap: true,
      })
    }

    // Content
    if (message.content) {
      body.push({
        type: 'TextBlock',
        text: message.content,
        wrap: true,
      })
    }

    // Timestamp
    body.push({
      type: 'TextBlock',
      text: new Date().toLocaleString(),
      size: 'Small',
      color: 'Dark',
      wrap: true,
    })

    return {
      type: 'AdaptiveCard',
      version: '1.4',
      $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
      body,
    }
  }
}

/**
 * Send a message to Microsoft Teams
 */
export async function send(message: ChatMessage, options?: RenderOptions): Promise<ChatResult> {
  const driver = new TeamsDriver()
  return driver.send(message, options)
}

/**
 * Send a simple text message to Teams via webhook
 */
export async function sendWebhook(
  webhookUrl: string,
  text: string,
): Promise<ChatResult> {
  try {
    const payload: TeamsMessage = {
      type: 'message',
      text,
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        provider: 'teams',
        message: `Webhook failed: ${response.status} - ${errorText}`,
      }
    }

    return {
      success: true,
      provider: 'teams',
      message: 'Message sent successfully',
    }
  }
  catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    return {
      success: false,
      provider: 'teams',
      message: err.message,
    }
  }
}

/**
 * Send an Adaptive Card to Teams via webhook
 */
export async function sendCard(
  webhookUrl: string,
  card: TeamsAdaptiveCard,
  summary?: string,
): Promise<ChatResult> {
  try {
    const payload: TeamsMessage = {
      type: 'message',
      summary: summary || 'Notification',
      attachments: [
        {
          contentType: 'application/vnd.microsoft.card.adaptive',
          content: card,
        },
      ],
    }

    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      return {
        success: false,
        provider: 'teams',
        message: `Webhook failed: ${response.status} - ${errorText}`,
      }
    }

    return {
      success: true,
      provider: 'teams',
      message: 'Card sent successfully',
    }
  }
  catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    return {
      success: false,
      provider: 'teams',
      message: err.message,
    }
  }
}

export { TeamsDriver as Driver }
export const driver = new TeamsDriver()
export default { send, sendWebhook, sendCard, configure, TeamsDriver }
