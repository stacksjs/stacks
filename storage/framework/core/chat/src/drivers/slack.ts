import type { ChatMessage, ChatResult, RenderOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { appServices, count, present } from '../app-config'
import type { ChatTransportOptions } from '../transport'
import { chatJson, chatRequest, ChatTransportError } from '../transport'
import { BaseChatDriver } from './base'

/**
 * `ChatMessage.content` is plain text, and Slack reads `&`, `<` and `>` as
 * markup, so they are escaped as Slack's docs ask for literal text. Unescaped,
 * a body carrying `<!channel>` pinged the whole channel and
 * `<https://evil.test|your invoice>` showed as "your invoice". Plain URLs
 * still turn into links. `sendWebhook(url, text)` stays raw, for markup
 * written on purpose.
 */
export function escapeSlackText(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

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
 * Configure Slack with webhook URL or bot token.
 *
 * Validates that the webhook URL (when provided) is HTTPS pointing at
 * Slack's webhook host. A misconfigured `http://` URL would leak the
 * channel-specific token in plaintext to anyone watching network
 * traffic; a typo'd domain would silently send messages to whatever
 * server happens to accept them.
 */
/** Refuse a webhook URL that would leak its token or send somewhere that is not Slack. */
function assertWebhookUrl(webhookUrl: string): void {
  let parsed: URL
  try {
    parsed = new URL(webhookUrl)
  }
  catch {
    throw new Error(`[chat/slack] webhookUrl is not a valid URL: ${webhookUrl}`)
  }
  if (parsed.protocol !== 'https:') {
    throw new Error('[chat/slack] webhookUrl must use https:// - Slack does not accept plain HTTP webhooks.')
  }
  if (!/(?:^|\.)slack\.com$/i.test(parsed.hostname)) {
    throw new Error(`[chat/slack] webhookUrl host "${parsed.hostname}" is not a Slack-owned domain.`)
  }
}

export function configure(options: SlackConfig): void {
  if (options.webhookUrl)
    assertWebhookUrl(options.webhookUrl)
  config = { ...config, ...options }
}

/**
 * The settings a send uses: what `configure()` set, then the app's
 * `config/services.ts` (`services.slack`), read per send after the app's
 * config has loaded. A URL from config passes the same checks `configure()`
 * applies.
 */
export async function resolveConfig(): Promise<SlackConfig> {
  let fromApp: Record<string, unknown> = {}
  try {
    fromApp = ((await appServices()).slack ?? {}) as Record<string, unknown>
  }
  catch (error) {
    log.debug(`[chat/slack] could not read config/services.ts: ${error instanceof Error ? error.message : String(error)}`)
  }

  const webhookUrl = config.webhookUrl ?? present(fromApp.webhookUrl)
  if (webhookUrl && !config.webhookUrl)
    assertWebhookUrl(webhookUrl)

  return {
    webhookUrl,
    botToken: config.botToken ?? present(fromApp.botToken),
    maxRetries: config.maxRetries ?? count(fromApp.maxRetries),
    retryTimeout: config.retryTimeout ?? count(fromApp.retryTimeout),
  }
}

export class SlackDriver extends BaseChatDriver {
  public name = 'slack'

  /** What this send uses; see {@link resolveConfig}. */
  private readonly explicitSettings?: SlackConfig
  private readonly fetcher: typeof fetch

  /** Retry settings passed to the constructor win over config/services.ts. */
  private readonly explicitRetries: { maxRetries?: number, retryTimeout?: number }

  constructor(options?: SlackConfig, transport: ChatTransportOptions = {}) {
    super({
      maxRetries: options?.maxRetries ?? 3,
      retryTimeout: options?.retryTimeout ?? 1000,
    })
    this.explicitRetries = { maxRetries: options?.maxRetries, retryTimeout: options?.retryTimeout }
    this.fetcher = transport.fetch ?? ((input, init) => fetch(input, init)) as typeof fetch
    if (options?.webhookUrl)
      assertWebhookUrl(options.webhookUrl)
    // Explicit credentials belong to THIS instance. They must never mutate or
    // inherit the app-wide credentials used by another tenant's driver.
    if (options?.webhookUrl || options?.botToken)
      this.explicitSettings = { ...options }
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
      const settings = this.explicitSettings ?? await resolveConfig()
      this.config = {
        ...this.config,
        maxRetries: this.explicitRetries.maxRetries ?? settings.maxRetries ?? this.config.maxRetries,
        retryTimeout: this.explicitRetries.retryTimeout ?? settings.retryTimeout ?? this.config.retryTimeout,
      }
      return await this.sendWithRetry(message, settings, options)
    }
    catch (error) {
      const result = await this.handleError(error, message)
      return { ...result, data: { ...result.data, outcome: error instanceof ChatTransportError ? error.outcome : 'rejected', httpStatus: error instanceof ChatTransportError ? error.httpStatus : undefined } }
    }
  }

  private async sendWithRetry(message: ChatMessage, settings: SlackConfig, options?: RenderOptions, attempt = 1): Promise<ChatResult> {
    try {
      const response = await this.sendMessage(message, settings, options)
      let result: ChatResult
      try {
        result = await this.handleSuccess(message, response.ts)
      }
      catch {
        result = { success: false, provider: this.name, message: 'Message accepted; completion callback failed' }
      }
      return { ...result, messageId: response.ts, data: { ...result.data, outcome: 'accepted' } }
    }
    catch (error) {
      if (error instanceof ChatTransportError && error.httpStatus === 429 && attempt < this.config.maxRetries) {
        log.warn(`[${this.name}] Message send failed, retrying (${attempt}/${this.config.maxRetries})`)
        await new Promise(resolve => setTimeout(resolve, error.retryAfterMs ?? this.config.retryTimeout))
        return this.sendWithRetry(message, settings, options, attempt + 1)
      }
      throw error
    }
  }

  private async sendMessage(message: ChatMessage, settings: SlackConfig, _options?: RenderOptions): Promise<{ ts?: string }> {
    // Use webhook if available, otherwise use bot token
    if (settings.webhookUrl) {
      return this.sendViaWebhook(message, settings)
    }

    if (settings.botToken) {
      return this.sendViaBotToken(message, settings)
    }

    throw new Error('Slack not configured: provide webhookUrl or botToken')
  }

  private async sendViaWebhook(message: ChatMessage, settings: SlackConfig): Promise<{ ts?: string }> {
    const text = escapeSlackText(message.content || message.subject || '')
    const payload: SlackMessage = {
      text,
      // `from` is an object - `{ id?, name?, avatar? }` - and `username` is a
      // string, so the whole object was being handed over and arrived as
      // "[object Object]". The sender's name is what this field is for.
      username: message.from?.name,
      mrkdwn: true,
    }

    // Add blocks if template data provided
    if (message.template) {
      payload.blocks = this.buildBlocks(message)
    }
    if ((payload.text?.length ?? 0) > 40000)
      throw new Error('Slack message exceeds 40000 characters')

    await chatRequest(this.fetcher, settings.webhookUrl!, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    })

    return {}
  }

  private async sendViaBotToken(message: ChatMessage, settings: SlackConfig): Promise<{ ts?: string }> {
    if (!message.to)
      throw new Error('Slack bot-token sends need message.to: the channel to post in')

    const payload: any = {
      channel: message.to,
      ...(typeof message.data?.threadTs === 'string' ? { thread_ts: message.data.threadTs } : {}),
      text: escapeSlackText(message.content || message.subject || ''),
      mrkdwn: true,
    }

    if (message.template) {
      payload.blocks = this.buildBlocks(message)
    }
    if ((payload.text?.length ?? 0) > 40000)
      throw new Error('Slack message exceeds 40000 characters')

    const response = await chatRequest(this.fetcher, 'https://slack.com/api/chat.postMessage', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${settings.botToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    })

    const result = await chatJson<{ ok: boolean, ts?: string, error?: string }>(response)

    if (!result.ok) {
      throw new ChatTransportError(`Slack API error: ${result.error}`, 'rejected', result.error === 'ratelimited' ? 429 : undefined)
    }

    if (!result.ts)
      throw new ChatTransportError('Slack acknowledgement has no message ID', 'unknown')
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
          text: escapeSlackText(message.content),
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
