import type { ChatMessage, ChatResult, RenderOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { BaseChatDriver } from './base'

export interface SlackConfig {
  webhookUrl?: string
  botToken?: string
  maxRetries?: number
  retryTimeout?: number
}

export interface SlackMessage {
  channel?: string
  text?: string
  blocks?: SlackBlock[]
  attachments?: SlackAttachment[]
  username?: string
  iconEmoji?: string
  iconUrl?: string
  threadTs?: string
  mrkdwn?: boolean
}

export interface SlackBlock {
  type: 'section' | 'divider' | 'header' | 'context' | 'actions' | 'image'
  text?: {
    type: 'plain_text' | 'mrkdwn'
    text: string
    emoji?: boolean
  }
  accessory?: any
  elements?: any[]
  block_id?: string
}

export interface SlackAttachment {
  color?: string
  pretext?: string
  author_name?: string
  author_link?: string
  author_icon?: string
  title?: string
  title_link?: string
  text?: string
  fields?: Array<{
    title: string
    value: string
    short?: boolean
  }>
  image_url?: string
  thumb_url?: string
  footer?: string
  footer_icon?: string
  ts?: number
}

let config: SlackConfig = {}

/**
 * Configure Slack with webhook URL or bot token
 */
export function configure(options: SlackConfig): void {
  config = { ...config, ...options }
}

export class SlackDriver extends BaseChatDriver {
  public name = 'slack'

  constructor(options?: SlackConfig) {
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

    log.info('Sending message via Slack...', logContext)

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
      const response = await this.sendMessage(message, options)
      return this.handleSuccess(message, response.ts)
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

  private async sendMessage(message: ChatMessage, _options?: RenderOptions): Promise<{ ts?: string }> {
    // Use webhook if available, otherwise use bot token
    if (config.webhookUrl) {
      return this.sendViaWebhook(message)
    }

    if (config.botToken) {
      return this.sendViaBotToken(message)
    }

    throw new Error('Slack not configured: provide webhookUrl or botToken')
  }

  private async sendViaWebhook(message: ChatMessage): Promise<{ ts?: string }> {
    const payload: SlackMessage = {
      text: message.content || message.subject,
      username: message.from as any,
      mrkdwn: true,
    }

    // Add blocks if template data provided
    if (message.template) {
      payload.blocks = this.buildBlocks(message)
    }

    const response = await fetch(config.webhookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Slack webhook failed: ${response.status} - ${errorText}`)
    }

    return {}
  }

  private async sendViaBotToken(message: ChatMessage): Promise<{ ts?: string }> {
    const payload: any = {
      channel: message.to,
      text: message.content || message.subject,
      mrkdwn: true,
    }

    if (message.template) {
      payload.blocks = this.buildBlocks(message)
    }

    const response = await fetch('https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      throw new Error(`Slack API failed: ${response.status}`)
    }

    const result = await response.json() as { ok: boolean, ts?: string, error?: string }

    if (!result.ok) {
      throw new Error(`Slack API error: ${result.error}`)
    }

    return { ts: result.ts }
  }

  private buildBlocks(message: ChatMessage): SlackBlock[] {
    const blocks: SlackBlock[] = []

    // Header
    if (message.subject) {
      blocks.push({
        type: 'header',
        text: {
          type: 'plain_text',
          text: message.subject,
          emoji: true,
        },
      })
    }

    // Content
    if (message.content) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: message.content,
        },
      })
    }

    return blocks
  }
}

/**
 * Send a message to Slack
 */
export async function send(message: ChatMessage, options?: RenderOptions): Promise<ChatResult> {
  const driver = new SlackDriver()
  return driver.send(message, options)
}

/**
 * Send a simple text message to a Slack channel via webhook
 */
export async function sendWebhook(
  webhookUrl: string,
  text: string,
  options?: Partial<SlackMessage>,
): Promise<ChatResult> {
  try {
    const payload: SlackMessage = {
      text,
      ...options,
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
        provider: 'slack',
        message: `Webhook failed: ${response.status} - ${errorText}`,
      }
    }

    return {
      success: true,
      provider: 'slack',
      message: 'Message sent successfully',
    }
  }
  catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    return {
      success: false,
      provider: 'slack',
      message: err.message,
    }
  }
}

export { SlackDriver as Driver }
export const driver = new SlackDriver()
export default { send, sendWebhook, configure, SlackDriver }
