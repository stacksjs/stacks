---
name: stacks-chat
description: Use when implementing chat messaging in Stacks — sending messages to Slack (webhooks, bot tokens, block kit), Discord (webhooks, bot tokens, embeds), Microsoft Teams (adaptive cards, webhooks), the BaseChatDriver abstraction, retry logic, or multi-channel chat routing. Covers @stacksjs/chat.
license: MIT
compatibility: Bun >= 1.3.0, TypeScript
allowed-tools: Read Edit Write Bash Grep Glob
---

# Stacks Chat

Multi-driver chat messaging with Slack, Discord, and Microsoft Teams support. Each driver supports both webhook and bot token modes, with retry logic and structured message formats.

## Key Paths
- Core package: `storage/framework/core/chat/src/`
- Types: `storage/framework/core/types/src/chat.ts`

## Source Files
```
chat/src/
├── index.ts              # router, configure functions, type re-exports
└── drivers/
    ├── base.ts           # BaseChatDriver abstract class
    ├── slack.ts          # SlackDriver + sendWebhook()
    ├── discord.ts        # DiscordDriver + sendWebhook() + sendEmbed()
    └── teams.ts          # TeamsDriver + sendWebhook() + sendCard()
```

## Router (index.ts)

The main `send()` function routes to the specified driver. Default driver is `'slack'`:

```typescript
import { send, sendToSlack, sendToDiscord, sendToTeams } from '@stacksjs/chat'

// Route to driver (default: 'slack')
await send(message, { driver: 'slack' })
await send(message, { driver: 'discord' })
await send(message, { driver: 'teams' })

// Direct webhook helpers
await sendToSlack(webhookUrl, text, options?)
await sendToDiscord(webhookUrl, content, options?)
await sendToTeams(webhookUrl, text)
```

Configure functions:
```typescript
import { configureSlack, configureDiscord, configureTeams } from '@stacksjs/chat'
configureSlack({ webhookUrl: '...', botToken: '...' })
configureDiscord({ webhookUrl: '...', botToken: '...' })
configureTeams({ webhookUrl: '...' })
```

Exported types: `ChatDriver` (union), `SendOptions`, `SlackConfig`, `SlackMessage`, `SlackBlock`, `SlackAttachment`, `DiscordConfig`, `DiscordMessage`, `DiscordEmbed`, `TeamsConfig`, `TeamsMessage`, `TeamsAdaptiveCard`, `TeamsCardElement`, `TeamsCardAction`

## BaseChatDriver (base.ts)

Abstract base class all drivers extend. Implements `ChatDriver` interface from `@stacksjs/types`:

```typescript
abstract class BaseChatDriver implements ChatDriver {
  public abstract name: string
  protected config: Required<ChatDriverConfig>

  constructor(config?: ChatDriverConfig)  // defaults: maxRetries=3, retryTimeout=1000

  configure(config: ChatDriverConfig): void
  abstract send(message: ChatMessage, options?: RenderOptions): Promise<ChatResult>

  // Protected helpers
  protected validateMessage(message: ChatMessage): boolean  // throws if no `to` or no `content`/`template`
  protected async handleError(error: unknown, message: ChatMessage): Promise<ChatResult>
  protected async handleSuccess(message: ChatMessage, messageId?: string): Promise<ChatResult>
}
```

- `handleError()` logs the error, then calls `message.onError()` if defined, returns `ChatResult` with `success: false`
- `handleSuccess()` calls `message.handle()` first, then `message.onSuccess()` if defined, returns `ChatResult` with `success: true`
- Both handlers merge any partial result from callbacks into the final `ChatResult`

## ChatMessage Interface (from @stacksjs/types)

```typescript
interface ChatMessage {
  to: string | string[]                // recipient (channel ID, user ID, etc.)
  from?: { id?: string, name?: string, avatar?: string }
  subject?: string                      // title for rich messages
  content?: string                      // plain text content
  template?: string                     // template for rich message rendering
  data?: Record<string, any>           // template data
  attachments?: ChatAttachment[]
  onSuccess?: () => void | Promise<void> | Partial<ChatResult>
  onError?: (error: Error) => void | Promise<void> | Partial<ChatResult>
  handle?: () => void | Promise<void> | Partial<ChatResult>
  [key: string]: any                    // custom platform-specific fields
}
```

## ChatResult Interface (from @stacksjs/types)

```typescript
interface ChatResult {
  success: boolean
  message: string
  provider: string                      // 'slack' | 'discord' | 'teams'
  messageId?: string
  data?: Record<string, any>
}
```

## Slack Driver

### SlackConfig
```typescript
interface SlackConfig {
  webhookUrl?: string
  botToken?: string
  maxRetries?: number       // default: 3
  retryTimeout?: number     // default: 1000ms
}
```

### SlackMessage (for webhook payloads)
```typescript
interface SlackMessage {
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
```

### SlackBlock
```typescript
interface SlackBlock {
  type: 'section' | 'divider' | 'header' | 'context' | 'actions' | 'image'
  text?: { type: 'plain_text' | 'mrkdwn', text: string, emoji?: boolean }
  accessory?: any
  elements?: any[]
  block_id?: string
}
```

### SlackAttachment
```typescript
interface SlackAttachment {
  color?: string
  pretext?: string
  author_name?: string
  author_link?: string
  author_icon?: string
  title?: string
  title_link?: string
  text?: string
  fields?: Array<{ title: string, value: string, short?: boolean }>
  image_url?: string
  thumb_url?: string
  footer?: string
  footer_icon?: string
  ts?: number
}
```

### Slack Sending Modes

1. **Webhook mode**: If `config.webhookUrl` is set, sends via `POST` to webhook URL. Payload includes `text`, `username`, `mrkdwn: true`. If `message.template` exists, builds Block Kit blocks.
2. **Bot token mode**: If `config.botToken` is set, sends via Slack API `https://slack.com/api/chat.postMessage` with `Authorization: Bearer <token>`. Returns `ts` (timestamp) as message ID.
3. Throws `Error('Slack not configured: provide webhookUrl or botToken')` if neither is set.

### Direct Webhook Function
```typescript
async function sendWebhook(webhookUrl: string, text: string, options?: Partial<SlackMessage>): Promise<ChatResult>
```
Merges `options` into payload, sends POST to the provided webhook URL.

### Block Building
When `message.template` is set, `buildBlocks()` creates:
- A `header` block from `message.subject` (if present)
- A `section` block from `message.content` with `mrkdwn` type

### Exports
- `SlackDriver` class (also as `Driver`)
- `driver` -- pre-instantiated `SlackDriver` singleton
- `send()`, `sendWebhook()`, `configure()` functions

## Discord Driver

### DiscordConfig
```typescript
interface DiscordConfig {
  webhookUrl?: string
  botToken?: string
  maxRetries?: number       // default: 3
  retryTimeout?: number     // default: 1000ms
}
```

### DiscordEmbed
```typescript
interface DiscordEmbed {
  title?: string
  description?: string
  url?: string
  color?: number              // integer color value (e.g. 0x5865F2)
  timestamp?: string          // ISO 8601
  footer?: { text: string, icon_url?: string }
  image?: { url: string }
  thumbnail?: { url: string }
  author?: { name: string, url?: string, icon_url?: string }
  fields?: Array<{ name: string, value: string, inline?: boolean }>
}
```

### DiscordMessage
```typescript
interface DiscordMessage {
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
```

### Discord Sending Modes

1. **Webhook mode**: POST to `config.webhookUrl`. Handles `204` (empty success) responses. Returns `id` from response.
2. **Bot token mode**: POST to `https://discord.com/api/v10/channels/{channelId}/messages` with `Authorization: Bot <token>`. Uses `message.to` as the channel ID.

### Embed Building
When `message.subject` or `message.template` is set, `buildEmbed()` creates an embed with:
- `title` from `message.subject`
- `description` from `message.content`
- Default color: `0x5865F2` (Discord blurple)
- `timestamp`: current ISO date

### Extra Functions
```typescript
async function sendWebhook(webhookUrl: string, content: string, options?: Partial<DiscordMessage>): Promise<ChatResult>
async function sendEmbed(webhookUrl: string, embed: DiscordEmbed, options?: Partial<DiscordMessage>): Promise<ChatResult>
```
`sendEmbed()` wraps the embed inside `sendWebhook()` with empty content.

### Exports
- `DiscordDriver` class (also as `Driver`)
- `driver` -- pre-instantiated singleton
- `send()`, `sendWebhook()`, `sendEmbed()`, `configure()` functions

## Teams Driver

### TeamsConfig
```typescript
interface TeamsConfig {
  webhookUrl?: string
  maxRetries?: number       // default: 3
  retryTimeout?: number     // default: 1000ms
}
```

### TeamsAdaptiveCard
```typescript
interface TeamsAdaptiveCard {
  type: 'AdaptiveCard'
  version: string           // '1.4'
  body: TeamsCardElement[]
  actions?: TeamsCardAction[]
  $schema?: string          // 'http://adaptivecards.io/schemas/adaptive-card.json'
}
```

### TeamsCardElement
```typescript
interface TeamsCardElement {
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
```

### TeamsCardAction
```typescript
interface TeamsCardAction {
  type: 'Action.OpenUrl' | 'Action.Submit' | 'Action.ShowCard'
  title: string
  url?: string
  data?: Record<string, any>
  card?: TeamsAdaptiveCard
}
```

### TeamsMessage
```typescript
interface TeamsMessage {
  type?: 'message'
  summary?: string
  text?: string
  attachments?: Array<{
    contentType: 'application/vnd.microsoft.card.adaptive'
    content: TeamsAdaptiveCard
  }>
}
```

### Teams Sending

- Uses `config.webhookUrl` or falls back to `message.to` as the webhook URL
- Validates URL contains `webhook.office.com`
- Simple messages (no subject/template): sends `{ type: 'message', text: content }`
- Rich messages (with subject or template): builds an Adaptive Card v1.4 with:
  - Title as `TextBlock` (size: Large, weight: Bolder)
  - Content as `TextBlock` (wrap: true)
  - Timestamp as `TextBlock` (size: Small, color: Dark)

### Extra Functions
```typescript
async function sendWebhook(webhookUrl: string, text: string): Promise<ChatResult>
async function sendCard(webhookUrl: string, card: TeamsAdaptiveCard, summary?: string): Promise<ChatResult>
```

### Exports
- `TeamsDriver` class (also as `Driver`)
- `driver` -- pre-instantiated singleton
- `send()`, `sendWebhook()`, `sendCard()`, `configure()` functions

## Retry Logic

All three drivers implement `sendWithRetry()`:
- Retries up to `config.maxRetries` times (default 3)
- Waits `config.retryTimeout` ms between attempts (default 1000ms)
- On final failure, throws the error (caught by the outer `send()` which calls `handleError()`)

## Dependencies
- `@stacksjs/types` -- `ChatMessage`, `ChatResult`, `RenderOptions`, `ChatDriver`, `ChatDriverConfig`
- `@stacksjs/logging` -- `log` for info/warn/error logging

## Gotchas
- The default driver for `send()` is `'slack'`, not auto-detected
- Each driver has two modes: webhook (simpler) and bot token (richer, returns message IDs)
- Slack bot token mode uses `https://slack.com/api/chat.postMessage`, not a webhook
- Discord webhook returns `204` on success with no body -- this is handled as success
- Discord bot token mode uses `message.to` as the channel ID
- Teams validates that the webhook URL contains `webhook.office.com`
- Teams uses `message.to` as fallback webhook URL if `config.webhookUrl` is not set
- All drivers set `mrkdwn: true` or equivalent by default
- Block Kit blocks are only built when `message.template` is set (Slack) or when `message.subject`/`message.template` is set (Discord/Teams)
- `validateMessage()` requires both `to` and either `content` or `template`
- The `handle()` callback runs before `onSuccess()` -- both results are merged
- `ChatMessage` supports `onSuccess`, `onError`, and `handle` callbacks that can return partial `ChatResult` objects
- Each driver module exports a pre-instantiated `driver` singleton and both class-based and function-based APIs
- Discord embed default color is `0x5865F2` (Discord blurple), not customizable via the auto-build path
- Teams Adaptive Cards use version `1.4` with the official JSON schema URL
