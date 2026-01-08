import type { ChatMessage, ChatResult, RenderOptions } from '@stacksjs/types'
import * as discord from './drivers/discord'
import * as slack from './drivers/slack'
import * as teams from './drivers/teams'

export * as discord from './drivers/discord'
export * as slack from './drivers/slack'
export * as teams from './drivers/teams'

export type ChatDriver = 'slack' | 'discord' | 'teams'

export interface SendOptions {
  driver?: ChatDriver
}

/**
 * Send a chat message using the specified driver
 */
export async function send(
  message: ChatMessage,
  options: SendOptions = {},
): Promise<ChatResult> {
  const driver = options.driver ?? 'slack'

  switch (driver) {
    case 'slack':
      return slack.send(message)
    case 'discord':
      return discord.send(message)
    case 'teams':
      return teams.send(message)
    default:
      return {
        success: false,
        provider: driver,
        message: `Unknown chat driver: ${driver}`,
      }
  }
}

/**
 * Send a message to Slack via webhook
 */
export async function sendToSlack(
  webhookUrl: string,
  text: string,
  options?: Parameters<typeof slack.sendWebhook>[2],
): Promise<ChatResult> {
  return slack.sendWebhook(webhookUrl, text, options)
}

/**
 * Send a message to Discord via webhook
 */
export async function sendToDiscord(
  webhookUrl: string,
  content: string,
  options?: Parameters<typeof discord.sendWebhook>[2],
): Promise<ChatResult> {
  return discord.sendWebhook(webhookUrl, content, options)
}

/**
 * Send a message to Teams via webhook
 */
export async function sendToTeams(
  webhookUrl: string,
  text: string,
): Promise<ChatResult> {
  return teams.sendWebhook(webhookUrl, text)
}

/**
 * Configure Slack driver
 */
export function configureSlack(config: slack.SlackConfig): void {
  slack.configure(config)
}

/**
 * Configure Discord driver
 */
export function configureDiscord(config: discord.DiscordConfig): void {
  discord.configure(config)
}

/**
 * Configure Teams driver
 */
export function configureTeams(config: teams.TeamsConfig): void {
  teams.configure(config)
}

// Re-export types
export type { SlackConfig, SlackMessage, SlackBlock, SlackAttachment } from './drivers/slack'
export type { DiscordConfig, DiscordMessage, DiscordEmbed } from './drivers/discord'
export type { TeamsConfig, TeamsMessage, TeamsAdaptiveCard, TeamsCardElement, TeamsCardAction } from './drivers/teams'
