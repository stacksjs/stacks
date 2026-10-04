import type { DiscordInboxConfig } from './discord'
import type { IMessageConfig } from './imessage/driver'
import type { SlackInboxConfig } from './slack'
import type { InboxDriver } from './types'
import { DiscordInboxDriver } from './discord'
import { IMessageDriver } from './imessage/driver'
import { SlackInboxDriver } from './slack'

export * from './types'
export { DiscordInboxDriver, snowflakeTime } from './discord'
export type { DiscordInboxConfig } from './discord'
export { IMessageDriver } from './imessage/driver'
export type { IMessageConfig } from './imessage/driver'
export { SlackApiError, SlackInboxDriver } from './slack'
export type { SlackInboxConfig } from './slack'
export { decodeAttributedBody } from './imessage/typedstream'
export { formatHandle, normalizeHandle } from './imessage/handles'

export interface InboxDriverConfigs {
  imessage: IMessageConfig
  slack: SlackInboxConfig
  discord: DiscordInboxConfig
}

/**
 * An inbox driver by name:
 *
 * ```ts
 * import { inbox } from '@stacksjs/chat'
 *
 * const drivers = [
 *   inbox.createInboxDriver('imessage', {}),
 *   inbox.createInboxDriver('slack', { token: env.SLACK_USER_TOKEN }),
 * ]
 * for (const driver of drivers) {
 *   for (const conversation of await driver.conversations())
 *     console.log(driver.label, conversation.title, conversation.archive.mode)
 * }
 * ```
 */
export function createInboxDriver<P extends keyof InboxDriverConfigs>(provider: P, config: InboxDriverConfigs[P]): InboxDriver {
  switch (provider) {
    case 'imessage':
      return new IMessageDriver(config as IMessageConfig)
    case 'slack':
      return new SlackInboxDriver(config as SlackInboxConfig)
    case 'discord':
      return new DiscordInboxDriver(config as DiscordInboxConfig)
    default:
      throw new Error(`Unknown inbox driver: ${String(provider)}`)
  }
}
