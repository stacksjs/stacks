import type { EmailMessage } from '@stacksjs/types'
import { mail } from '@stacksjs/email'
import { log } from '@stacksjs/logging'
import { Job } from '@stacksjs/queue'

/**
 * Background email-send job.
 *
 * `mail.queue(message)` (and `.later(seconds, message)` / `.queueOn(queue, message)`)
 * dispatch to a job named `SendEmail` — this is its handler. Without this
 * file the queued envelope just sat in the `jobs` table forever (the
 * framework had no shipped handler), so any caller using `mail.queue()`
 * silently dropped the email.
 *
 * Uses `mail.use(driver)` so the same payload can be sent through any
 * registered transport — preserves the driver the producer chose at
 * dispatch time even if the worker process inherits a different default.
 */
interface SendEmailPayload {
  message: EmailMessage
  driver?: string
}

export default new Job({
  name: 'SendEmail',
  description: 'Send an email via the configured transport (background)',
  queue: 'emails',
  tries: 3,
  backoff: [10, 30, 60], // 10s → 30s → 60s

  async handle(payload: SendEmailPayload) {
    if (!payload?.message) {
      throw new Error('[SendEmail] payload.message is required')
    }

    const transport = payload.driver
      ? mail.use(payload.driver)
      : mail

    const result = await transport.send(payload.message)

    if (!result?.success) {
      // Re-throw so the worker counts this as a failed attempt (and the
      // queue retries with the configured backoff). Without throwing,
      // failed sends would silently drop on the floor.
      throw new Error(`[SendEmail] driver '${result?.provider ?? payload.driver ?? 'default'}' returned failure: ${result?.message ?? 'unknown error'}`)
    }

    log.debug(`[SendEmail] sent via ${result.provider} (messageId=${result.messageId ?? 'n/a'})`)
    return { messageId: result.messageId, provider: result.provider }
  },
})
