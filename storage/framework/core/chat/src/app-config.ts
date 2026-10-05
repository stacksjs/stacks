import type { ServicesConfig } from '@stacksjs/types'

/**
 * The application's `config/services.ts`, read when a message is sent.
 *
 * Lazily and after `awaitConfig()`, never at import: until the app's own
 * config files have loaded, `config.services` holds the framework defaults.
 * The Slack, Discord and Teams drivers used to read nothing here at all, so
 * `SLACK_WEBHOOK_URL`, `DISCORD_WEBHOOK_URL` and `TEAMS_WEBHOOK_URL` - which
 * the config file invites - did nothing unless the app also called
 * `configure()` itself (the chat half of stacksjs/stacks#2857).
 */
export async function appServices(): Promise<ServicesConfig> {
  const { awaitConfig } = await import('@stacksjs/config')
  return (await awaitConfig()).services ?? {}
}

/** A credential from config, blank meaning unset: `config/services.ts` writes `''` for a missing variable. */
export function present(value: unknown): string | undefined {
  const text = value == null ? '' : String(value).trim()
  return text || undefined
}

/** A retry setting from config, kept only when it is a usable number (0 included). */
export function count(value: unknown): number | undefined {
  const number = Number(value)
  return value !== '' && value != null && Number.isFinite(number) && number >= 0 ? number : undefined
}
