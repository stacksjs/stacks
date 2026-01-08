import type { ChatMessage, ChatResult, RenderOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { BaseChatDriver } from './base'

export interface DiscordConfig {
  webhookUrl?: string
  botToken?: string
  maxRetries?: number
  retryTimeout?: number
}

export interface DiscordEmbed {
  title?: string
  description?: string
  url?: string
  color?: number
  timestamp?: string
  footer?: {
    text: string
    icon_url?: string
  }
  image?: {
    url: string
  }
  thumbnail?: {
    url: string
  }
  author?: {
    name: string
    url?: string
    icon_url?: string
  }
  fields?: Array<{
    name: string
    value: string
    inline?: boolean
  }>
}

export interface DiscordMessage {
  content?: string
  username?: string
  avatarUrl?: string
  tts?: boolean
  embeds?: DiscordEmbed[]
  allowedMentions?: {
    parse?: Array<'roles' | 'users' | 'everyone'>
    roles?: string[]
    users?: string[]
  }
}

let config: DiscordConfig = {}

/**
 * Configure Discord with webhook URL or bot token
 */
export function configure(options: DiscordConfig): void {
  config = { ...config, ...options }
}

export class DiscordDriver extends BaseChatDriver {
  public name = 'discord'

  constructor(options?: DiscordConfig) {
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

    log.info('Sending message via Discord...', logContext)

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
      return this.handleSuccess(message, response.id)
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

  private async sendMessage(message: ChatMessage, _options?: RenderOptions): Promise<{ id?: string }> {
    if (config.webhookUrl) {
      return this.sendViaWebhook(message)
    }

    if (config.botToken) {
      return this.sendViaBotToken(message)
    }

    throw new Error('Discord not configured: provide webhookUrl or botToken')
  }

  private async sendViaWebhook(message: ChatMessage): Promise<{ id?: string }> {
    const payload: DiscordMessage = {
      content: message.content,
      username: message.from,
    }

    // Add embeds if template or subject provided
    if (message.subject || message.template) {
      payload.embeds = [this.buildEmbed(message)]
    }

    const response = await fetch(config.webhookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorText = await response.text()
      throw new Error(`Discord webhook failed: ${response.status} - ${errorText}`)
    }

    // Webhooks can return empty response on success
    if (response.status === 204) {
      return {}
    }

    const result = await response.json() as { id?: string }
    return { id: result.id }
  }

  private async sendViaBotToken(message: ChatMessage): Promise<{ id?: string }> {
    const channelId = message.to

    const payload: any = {
      content: message.content,
    }

    if (message.subject || message.template) {
      payload.embeds = [this.buildEmbed(message)]
    }

    const response = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
      method: 'POST',
      headers: {
        'Authorization': `Bot ${config.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    if (!response.ok) {
      const errorData = await response.json() as { message?: string }
      throw new Error(`Discord API failed: ${response.status} - ${errorData.message}`)
    }

    const result = await response.json() as { id: string }
    return { id: result.id }
  }

  private buildEmbed(message: ChatMessage): DiscordEmbed {
    const embed: DiscordEmbed = {}

    if (message.subject) {
      embed.title = message.subject
    }

    if (message.content) {
      embed.description = message.content
    }

    // Default color (blue)
    embed.color = 0x5865F2

    embed.timestamp = new Date().toISOString()

    return embed
  }
}

/**
 * Send a message to Discord
 */
export async function send(message: ChatMessage, options?: RenderOptions): Promise<ChatResult> {
  const driver = new DiscordDriver()
  return driver.send(message, options)
}

/**
 * Send a simple message via Discord webhook
 */
export async function sendWebhook(
  webhookUrl: string,
  content: string,
  options?: Partial<DiscordMessage>,
): Promise<ChatResult> {
  try {
    const payload: DiscordMessage = {
      content,
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
        provider: 'discord',
        message: `Webhook failed: ${response.status} - ${errorText}`,
      }
    }

    return {
      success: true,
      provider: 'discord',
      message: 'Message sent successfully',
    }
  }
  catch (error) {
    const err = error instanceof Error ? error : new Error(String(error))
    return {
      success: false,
      provider: 'discord',
      message: err.message,
    }
  }
}

/**
 * Send an embed message via Discord webhook
 */
export async function sendEmbed(
  webhookUrl: string,
  embed: DiscordEmbed,
  options?: Partial<DiscordMessage>,
): Promise<ChatResult> {
  return sendWebhook(webhookUrl, '', {
    ...options,
    embeds: [embed],
  })
}

export { DiscordDriver as Driver }
export const driver = new DiscordDriver()
export default { send, sendWebhook, sendEmbed, configure, DiscordDriver }
