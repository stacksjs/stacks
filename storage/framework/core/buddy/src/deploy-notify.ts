/**
 * Deploy outcome notifications.
 *
 * A deploy that fails is the one event nobody is watching for: the previous
 * release keeps serving, so the site stays up, uptime monitors stay green, and
 * `main` silently drifts from production. This repo lost a month that way — CI
 * was green on lint/typecheck/test and only the last job was red.
 *
 * This lives in buddy rather than in the CI workflow on purpose. buddy is what
 * actually runs a deploy, so hooking the outcome here covers every path — a
 * GitHub Actions run, a laptop, a cron — instead of only the one provider whose
 * YAML someone remembered to edit. It composes `@stacksjs/chat` for delivery
 * rather than posting webhooks itself: buddy knows *what happened*, chat knows
 * *how to send*.
 *
 * Configuration is one variable, because anything more gets skipped:
 *
 *   DEPLOY_WEBHOOK_URL=https://discord.com/api/webhooks/...
 *
 * The driver is inferred from the host. Set DEPLOY_WEBHOOK_DRIVER to override,
 * and DEPLOY_WEBHOOK_NOTIFY=all to be told about successful deploys too
 * (default is failures only — a green deploy is not news).
 */

import process from 'node:process'
import { sendToDiscord, sendToSlack, sendToTeams } from '@stacksjs/chat'
import { log } from '@stacksjs/logging'
import { ExitCode } from '@stacksjs/types'

export type DeployWebhookDriver = 'slack' | 'discord' | 'teams'

export interface DeployOutcome {
  status: 'failed' | 'succeeded'
  /** 'production' | 'staging' | ... — whatever was deployed to. */
  environment?: string
  /** 'hetzner' | 'aws' | ... */
  provider?: string
  project?: string
  /** Wall-clock duration, when the caller tracked one. */
  durationMs?: number
  /** The failure. Only read for `status: 'failed'`. */
  error?: unknown
}

export interface DeployNotifyConfig {
  url?: string
  driver?: DeployWebhookDriver
  /** 'failure' (default) or 'all'. */
  notifyOn?: 'failure' | 'all'
}

/**
 * Infer the chat driver from the webhook host, so the common case needs no
 * driver setting at all. Unrecognised hosts fall back to Slack, whose plain
 * `{ text }` body is what most webhook receivers (and every "Slack-compatible"
 * endpoint) accept.
 */
export function driverForWebhookUrl(url: string): DeployWebhookDriver {
  let host = ''
  try {
    host = new URL(url).hostname.toLowerCase()
  }
  catch {
    return 'slack'
  }

  if (host.endsWith('discord.com') || host.endsWith('discordapp.com'))
    return 'discord'
  if (host.endsWith('office.com') || host.endsWith('office365.com') || host.endsWith('outlook.com'))
    return 'teams'
  return 'slack'
}

/** Read the notify config from the environment. Absent URL disables the feature. */
export function resolveDeployNotifyConfig(env: Record<string, string | undefined> = process.env): DeployNotifyConfig {
  const url = env.DEPLOY_WEBHOOK_URL?.trim()
  if (!url)
    return {}

  const rawDriver = env.DEPLOY_WEBHOOK_DRIVER?.trim().toLowerCase()
  const driver: DeployWebhookDriver | undefined
    = rawDriver === 'slack' || rawDriver === 'discord' || rawDriver === 'teams' ? rawDriver : undefined

  return {
    url,
    driver: driver ?? driverForWebhookUrl(url),
    notifyOn: env.DEPLOY_WEBHOOK_NOTIFY?.trim().toLowerCase() === 'all' ? 'all' : 'failure',
  }
}

/** Trim a stack/message down to something a chat message can carry. */
function summarizeError(error: unknown, limit = 1200): string {
  if (error == null)
    return 'No error detail was captured.'
  const text = error instanceof Error ? (error.stack || error.message) : String(error)
  const trimmed = text.trim()
  return trimmed.length > limit ? `${trimmed.slice(0, limit)}\n… (truncated)` : trimmed
}

function formatDuration(ms?: number): string | null {
  if (typeof ms !== 'number' || !Number.isFinite(ms) || ms < 0)
    return null
  const total = Math.round(ms / 1000)
  return total < 60 ? `${total}s` : `${Math.floor(total / 60)}m ${total % 60}s`
}

/**
 * CI context, when there is any. A deploy notification that does not say which
 * commit it was is close to useless — you cannot tell a stale alert from a live
 * one. GitHub Actions exports these for free; outside CI they are simply absent.
 */
function ciContext(env: Record<string, string | undefined> = process.env): string[] {
  const lines: string[] = []
  const repo = env.GITHUB_REPOSITORY
  const sha = env.GITHUB_SHA
  if (repo && sha)
    lines.push(`Commit: ${repo}@${sha.slice(0, 7)}`)
  else if (sha)
    lines.push(`Commit: ${sha.slice(0, 7)}`)

  if (repo && env.GITHUB_RUN_ID)
    lines.push(`Run: ${env.GITHUB_SERVER_URL || 'https://github.com'}/${repo}/actions/runs/${env.GITHUB_RUN_ID}`)

  return lines
}

/** The message body, kept separate from delivery so it can be asserted on. */
export function buildDeployMessage(outcome: DeployOutcome, env: Record<string, string | undefined> = process.env): string {
  const failed = outcome.status === 'failed'
  const target = [outcome.project, outcome.environment].filter(Boolean).join(' · ') || 'project'
  const heading = failed
    ? `🔴 Deploy FAILED - ${target}`
    : `✅ Deploy succeeded - ${target}`

  const lines = [heading]
  if (outcome.provider)
    lines.push(`Provider: ${outcome.provider}`)

  const duration = formatDuration(outcome.durationMs)
  if (duration)
    lines.push(`Duration: ${duration}`)

  lines.push(...ciContext(env))

  if (failed) {
    lines.push('')
    lines.push('```')
    lines.push(summarizeError(outcome.error))
    lines.push('```')
    // The whole point: the site is still up on the old release, so nothing
    // else will tell you the environment is now behind main. Name the actual
    // environment — claiming "production" on a staging deploy is the kind of
    // detail that makes people stop trusting an alert.
    const envLabel = outcome.environment || 'The target environment'
    lines.push(`${envLabel === 'production' ? 'Production' : envLabel} is still serving the previous release.`)
  }

  return lines.join('\n')
}

/**
 * Announce a deploy outcome. Never throws and never rejects: a broken or
 * unreachable webhook must not turn a successful deploy into a failed one, nor
 * mask the real error behind a delivery error. Returns whether a message was
 * actually delivered, which is what the tests assert on.
 */
export async function notifyDeployOutcome(
  outcome: DeployOutcome,
  config: DeployNotifyConfig = resolveDeployNotifyConfig(),
): Promise<boolean> {
  try {
    if (!config.url) {
      log.debug('[deploy] no DEPLOY_WEBHOOK_URL set - skipping deploy notification')
      return false
    }

    const notifyOn = config.notifyOn ?? 'failure'
    if (outcome.status === 'succeeded' && notifyOn !== 'all') {
      log.debug('[deploy] deploy succeeded and DEPLOY_WEBHOOK_NOTIFY is not "all" - not notifying')
      return false
    }

    const driver = config.driver ?? driverForWebhookUrl(config.url)
    const message = buildDeployMessage(outcome)

    const result = driver === 'discord'
      ? await sendToDiscord(config.url, message)
      : driver === 'teams'
        ? await sendToTeams(config.url, message)
        : await sendToSlack(config.url, message)

    if (!result?.success) {
      log.warn(`[deploy] deploy notification to ${driver} failed: ${result?.message ?? 'unknown error'}`)
      return false
    }

    log.debug(`[deploy] deploy ${outcome.status} notification sent via ${driver}`)
    return true
  }
  catch (error) {
    log.warn(`[deploy] deploy notification could not be sent: ${error instanceof Error ? error.message : String(error)}`)
    return false
  }
}

/**
 * A message for the terminal, however the failure was thrown.
 *
 * A thrown string, a rejected promise carrying an object, and an Error with an
 * empty message all reach here, and "undefined" on the way out is barely
 * better than the silence this replaced.
 */
export function getDeployErrorMessage(error: unknown): string {
  if (error instanceof Error && error.message)
    return error.message
  if (typeof error === 'string' && error)
    return error

  try {
    const rendered = JSON.stringify(error)
    if (rendered && rendered !== '{}' && rendered !== 'null')
      return rendered
  }
  catch {}

  return `${String(error)} (no message; re-run with --verbose for the stack)`
}

/**
 * Wrap a deploy command handler so its outcome is announced exactly once,
 * whatever provider ran and however it failed.
 *
 * Wrapping the handler rather than editing each failure site is deliberate:
 * `deploy` has a dozen bail-out points across the AWS and Hetzner paths, and a
 * notification added to some-but-not-all of them is worse than none — you would
 * learn to trust a signal that is only sometimes there. Anything that throws or
 * rejects inside the handler lands here.
 *
 * The one rule for callers: fail by throwing, not by calling process.exit().
 * An inline exit unwinds nothing, so it would skip this handler silently.
 */
export function withDeployNotification<A extends unknown[]>(
  action: (...args: A) => Promise<void>,
): (...args: A) => Promise<void> {
  return async (...args: A): Promise<void> => {
    const startedAt = Date.now()
    // The command's first positional is the target environment.
    const environment = typeof args[0] === 'string' && args[0] ? args[0] : 'production'
    const context = {
      environment,
      provider: process.env.CLOUD_PROVIDER || undefined,
      project: process.env.APP_NAME || undefined,
    }

    try {
      await action(...args)
    }
    catch (error) {
      // Say what went wrong, on the terminal, before anything else.
      //
      // This used to notify and exit(1) without printing a word, so a deploy
      // that threw anywhere in the handler produced an empty terminal and a
      // bare exit code — no message, no stack, nothing to search for. A
      // notification is not a substitute: it goes to whatever channel is
      // configured, and on a machine with none configured it goes nowhere,
      // which is precisely the case where the operator is watching the
      // terminal and sees a black box.
      log.error(`Deploy to ${environment} failed: ${getDeployErrorMessage(error)}`)

      const stack = error instanceof Error ? error.stack : undefined
      if (stack)
        log.debug(stack)

      await notifyDeployOutcome({ ...context, status: 'failed', durationMs: Date.now() - startedAt, error })
      // Preserve the previous behaviour of the inline exits this replaced.
      process.exit(ExitCode.FatalError)
    }

    await notifyDeployOutcome({ ...context, status: 'succeeded', durationMs: Date.now() - startedAt })
  }
}
