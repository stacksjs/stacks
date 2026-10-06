import type { ChatMessage, ChatResult, RenderOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'
import { appServices, count, present } from '../app-config'
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
 * Hosts a Teams Workflows webhook is served from: Power Automate's
 * `*.environment.api.powerplatform.com` and `*.api.powerautomate.com`, and
 * the older Logic Apps `prod-NN.<region>.logic.azure.com`, in the public,
 * US Government and China clouds.
 */
const WORKFLOW_HOSTS = /(?:^|\.)(?:api\.powerplatform\.com|api\.powerautomate\.com|flow\.microsoft\.com|logic\.azure\.(?:com|us|cn))$/i

/**
 * A Teams webhook URL is a Workflows URL, on https, matched by host.
 *
 * The check was `url.includes('webhook.office.com')`, the Office 365
 * connector host - and Microsoft retired those connectors in May 2026, so the
 * one URL the driver accepted no longer delivers, and every URL that does was
 * refused as "not configured or invalid". A substring test also let through
 * any URL that merely mentioned the host, in a path or a query.
 */
export function assertWebhookUrl(webhookUrl: string): void {
  let parsed: URL
  try {
    parsed = new URL(webhookUrl)
  }
  catch {
    throw new Error(`[chat/teams] webhookUrl is not a valid URL: ${webhookUrl}`)
  }
  if (parsed.protocol !== 'https:')
    throw new Error('[chat/teams] webhookUrl must use https://')
  if (/(?:^|\.)webhook\.office\.com$/i.test(parsed.hostname)) {
    throw new Error(
      '[chat/teams] webhookUrl is an Office 365 connector webhook, which Microsoft retired in May 2026 and no longer delivers. '
      + 'Create one with the Workflows app in Teams ("Post to a channel when a webhook request is received") and use its URL.',
    )
  }
  if (!WORKFLOW_HOSTS.test(parsed.hostname))
    throw new Error(`[chat/teams] webhookUrl host "${parsed.hostname}" is not a Teams Workflows (Power Automate) host.`)
}

/**
 * Configure Teams with webhook URL
 */
export function configure(options: TeamsConfig): void {
  if (options.webhookUrl)
    assertWebhookUrl(options.webhookUrl)
  config = { ...config, ...options }
}

/**
 * The settings a send uses: what `configure()` set, then the app's
 * `config/services.ts` (`services.teams`), read per send after the app's
 * config has loaded. A URL from config passes the same checks `configure()`
 * applies.
 */
export async function resolveConfig(): Promise<TeamsConfig> {
  let fromApp: Record<string, unknown> = {}
  try {
    fromApp = ((await appServices()).teams ?? {}) as Record<string, unknown>
  }
  catch (error) {
    log.debug(`[chat/teams] could not read config/services.ts: ${error instanceof Error ? error.message : String(error)}`)
  }

  const webhookUrl = config.webhookUrl ?? present(fromApp.webhookUrl)
  if (webhookUrl && !config.webhookUrl)
    assertWebhookUrl(webhookUrl)

  return {
    webhookUrl,
    maxRetries: config.maxRetries ?? count(fromApp.maxRetries),
    retryTimeout: config.retryTimeout ?? count(fromApp.retryTimeout),
  }
}

export class TeamsDriver extends BaseChatDriver {
  public name = 'teams'

  /** What this send uses; see {@link resolveConfig}. */
  private settings: TeamsConfig = {}

  /** Retry settings passed to the constructor win over config/services.ts. */
  private readonly explicitRetries: { maxRetries?: number, retryTimeout?: number }

  constructor(options?: TeamsConfig) {
    super({
      maxRetries: options?.maxRetries ?? 3,
      retryTimeout: options?.retryTimeout ?? 1000,
    })
    this.explicitRetries = { maxRetries: options?.maxRetries, retryTimeout: options?.retryTimeout }
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
      this.settings = await resolveConfig()
      this.config = {
        ...this.config,
        maxRetries: this.explicitRetries.maxRetries ?? this.settings.maxRetries ?? this.config.maxRetries,
        retryTimeout: this.explicitRetries.retryTimeout ?? this.settings.retryTimeout ?? this.config.retryTimeout,
      }
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
    // `message.to` may be a list, and a Teams webhook targets exactly one URL.
    // Left as `string | string[]`, the guard below ran `.includes(...)` on an
    // array - which asks whether an ELEMENT equals 'webhook.office.com', never
    // true - so a message addressed with a list failed as "not configured"
    // rather than being sent. The cast on `fetch` is what let that through.
    const configured = this.settings.webhookUrl
    const webhookUrl = configured || (Array.isArray(message.to) ? message.to[0] : message.to)

    if (!webhookUrl)
      throw new Error('Teams webhook URL not configured')
    assertWebhookUrl(webhookUrl)

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

  /**
   * Always an Adaptive Card. The Workflows webhook template reads the card
   * from `attachments`, and a bare `{ text }` body - what a plain message used
   * to send - has none, so the flow failed with nothing posted.
   */
  private buildPayload(message: ChatMessage): TeamsMessage {
    return cardMessage(this.buildAdaptiveCard(message), message.subject || message.content?.substring(0, 50) || 'Notification')
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

    if (!message.subject && !message.template)
      return adaptiveCard(body)

    // Timestamp
    body.push({
      type: 'TextBlock',
      text: new Date().toLocaleString(),
      size: 'Small',
      color: 'Dark',
      wrap: true,
    })

    return adaptiveCard(body)
  }
}

function adaptiveCard(body: TeamsCardElement[]): TeamsAdaptiveCard {
  return {
    type: 'AdaptiveCard',
    version: '1.4',
    $schema: 'http://adaptivecards.io/schemas/adaptive-card.json',
    body,
  }
}

function cardMessage(card: TeamsAdaptiveCard, summary: string): TeamsMessage {
  return {
    type: 'message',
    summary,
    attachments: [
      {
        contentType: 'application/vnd.microsoft.card.adaptive',
        content: card,
      },
    ],
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
    assertWebhookUrl(webhookUrl)
    // A card with the text, for the same reason the driver sends one.
    const payload = cardMessage(adaptiveCard([{ type: 'TextBlock', text, wrap: true }]), text.substring(0, 50) || 'Notification')

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
    assertWebhookUrl(webhookUrl)
    const payload = cardMessage(card, summary || 'Notification')

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
