/**
 * Failed Job Notifications for Stacks
 *
 * Sends notifications when jobs fail via various channels.
 */

import type { JobOptions } from '@stacksjs/types'
import { log } from '@stacksjs/logging'

/**
 * Notification channel types
 */
export type NotificationChannel = 'email' | 'slack' | 'discord' | 'webhook' | 'log'

/**
 * Failed job info
 */
export interface FailedJobInfo {
  id: string | number
  name: string
  queue: string
  payload: any
  exception: string
  failedAt: Date
  attempts: number
  maxAttempts: number
}

/**
 * Notification configuration
 */
export interface FailedJobNotificationConfig {
  /**
   * Channels to notify
   */
  channels: NotificationChannel[]

  /**
   * Email configuration
   */
  email?: {
    to: string | string[]
    from?: string
    subject?: string
  }

  /**
   * Slack configuration
   */
  slack?: {
    webhookUrl: string
    channel?: string
    username?: string
    iconEmoji?: string
  }

  /**
   * Discord configuration
   */
  discord?: {
    webhookUrl: string
    username?: string
    avatarUrl?: string
  }

  /**
   * Generic webhook configuration
   */
  webhook?: {
    url: string
    headers?: Record<string, string>
    secret?: string
  }

  /**
   * Rate limiting - max notifications per hour
   */
  rateLimit?: number

  /**
   * Whether to batch notifications
   */
  batch?: boolean

  /**
   * Batch interval in milliseconds
   */
  batchInterval?: number

  /**
   * Filter function to determine if notification should be sent
   */
  filter?: (job: FailedJobInfo) => boolean
}

/**
 * Failed job notification manager
 */
export class FailedJobNotifier {
  private config: FailedJobNotificationConfig
  private notificationCount = 0
  private lastResetTime = Date.now()
  private pendingBatch: FailedJobInfo[] = []
  private batchTimeout: ReturnType<typeof setTimeout> | null = null

  constructor(config: FailedJobNotificationConfig) {
    this.config = config
  }

  /**
   * Notify about a failed job
   */
  async notify(job: FailedJobInfo): Promise<void> {
    // Check filter
    if (this.config.filter && !this.config.filter(job)) {
      return
    }

    // Check rate limit
    if (this.config.rateLimit) {
      const now = Date.now()
      if (now - this.lastResetTime > 3600000) {
        // Reset counter every hour
        this.notificationCount = 0
        this.lastResetTime = now
      }

      if (this.notificationCount >= this.config.rateLimit) {
        log.debug('Rate limit reached for failed job notifications')
        return
      }
    }

    // Handle batching
    if (this.config.batch) {
      this.pendingBatch.push(job)

      if (!this.batchTimeout) {
        this.batchTimeout = setTimeout(() => {
          this.flushBatch()
        }, this.config.batchInterval || 60000)
      }

      return
    }

    // Send immediately
    await this.sendNotifications([job])
  }

  /**
   * Flush pending batch
   */
  private async flushBatch(): Promise<void> {
    if (this.pendingBatch.length === 0)
      return

    const batch = [...this.pendingBatch]
    this.pendingBatch = []
    this.batchTimeout = null

    await this.sendNotifications(batch)
  }

  /**
   * Send notifications to all configured channels
   */
  private async sendNotifications(jobs: FailedJobInfo[]): Promise<void> {
    const promises: Promise<void>[] = []

    for (const channel of this.config.channels) {
      switch (channel) {
        case 'email':
          if (this.config.email) {
            promises.push(this.sendEmail(jobs))
          }
          break
        case 'slack':
          if (this.config.slack) {
            promises.push(this.sendSlack(jobs))
          }
          break
        case 'discord':
          if (this.config.discord) {
            promises.push(this.sendDiscord(jobs))
          }
          break
        case 'webhook':
          if (this.config.webhook) {
            promises.push(this.sendWebhook(jobs))
          }
          break
        case 'log':
          this.logFailures(jobs)
          break
      }
    }

    try {
      await Promise.all(promises)
      this.notificationCount += jobs.length
    }
    catch (error) {
      log.error('Failed to send job failure notifications:', error)
    }
  }

  /**
   * Send email notification
   */
  private async sendEmail(jobs: FailedJobInfo[]): Promise<void> {
    const config = this.config.email!
    const subject = config.subject || `[Queue] ${jobs.length} Job(s) Failed`

    const body = this.formatEmailBody(jobs)

    // Use Stacks mailer if available
    try {
      const { mail } = await import('@stacksjs/email')
      await mail({
        to: Array.isArray(config.to) ? config.to : [config.to],
        from: config.from,
        subject,
        html: body,
      })
    }
    catch (error) {
      log.error('Failed to send email notification:', error)
    }
  }

  /**
   * Format email body
   */
  private formatEmailBody(jobs: FailedJobInfo[]): string {
    const rows = jobs.map(job => `
      <tr>
        <td style="padding: 8px; border: 1px solid #ddd;">${job.id}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${job.name}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${job.queue}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${job.attempts}/${job.maxAttempts}</td>
        <td style="padding: 8px; border: 1px solid #ddd;">${job.failedAt.toISOString()}</td>
        <td style="padding: 8px; border: 1px solid #ddd;"><pre style="max-width: 300px; overflow: auto;">${job.exception}</pre></td>
      </tr>
    `).join('')

    return `
      <h2>Failed Jobs Report</h2>
      <p>${jobs.length} job(s) have failed.</p>
      <table style="border-collapse: collapse; width: 100%;">
        <thead>
          <tr style="background: #f5f5f5;">
            <th style="padding: 8px; border: 1px solid #ddd;">ID</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Name</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Queue</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Attempts</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Failed At</th>
            <th style="padding: 8px; border: 1px solid #ddd;">Exception</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    `
  }

  /**
   * Send Slack notification
   */
  private async sendSlack(jobs: FailedJobInfo[]): Promise<void> {
    const config = this.config.slack!

    const blocks = [
      {
        type: 'header',
        text: {
          type: 'plain_text',
          text: `🚨 ${jobs.length} Job(s) Failed`,
          emoji: true,
        },
      },
      ...jobs.slice(0, 10).map(job => ({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `*${job.name}*\nQueue: ${job.queue} | Attempts: ${job.attempts}/${job.maxAttempts}\n\`\`\`${job.exception.slice(0, 200)}\`\`\``,
        },
      })),
    ]

    if (jobs.length > 10) {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `_...and ${jobs.length - 10} more failed jobs_`,
        },
      })
    }

    try {
      await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channel: config.channel,
          username: config.username || 'Queue Monitor',
          icon_emoji: config.iconEmoji || ':warning:',
          blocks,
        }),
      })
    }
    catch (error) {
      log.error('Failed to send Slack notification:', error)
    }
  }

  /**
   * Send Discord notification
   */
  private async sendDiscord(jobs: FailedJobInfo[]): Promise<void> {
    const config = this.config.discord!

    const embeds = jobs.slice(0, 10).map(job => ({
      title: `❌ ${job.name}`,
      color: 15158332, // Red
      fields: [
        { name: 'Queue', value: job.queue, inline: true },
        { name: 'Attempts', value: `${job.attempts}/${job.maxAttempts}`, inline: true },
        { name: 'Failed At', value: job.failedAt.toISOString(), inline: true },
        { name: 'Exception', value: `\`\`\`${job.exception.slice(0, 500)}\`\`\`` },
      ],
      timestamp: job.failedAt.toISOString(),
    }))

    try {
      await fetch(config.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: config.username || 'Queue Monitor',
          avatar_url: config.avatarUrl,
          content: `🚨 **${jobs.length} Job(s) Failed**`,
          embeds,
        }),
      })
    }
    catch (error) {
      log.error('Failed to send Discord notification:', error)
    }
  }

  /**
   * Send webhook notification
   */
  private async sendWebhook(jobs: FailedJobInfo[]): Promise<void> {
    const config = this.config.webhook!

    const payload = {
      event: 'jobs.failed',
      timestamp: new Date().toISOString(),
      count: jobs.length,
      jobs: jobs.map(job => ({
        id: job.id,
        name: job.name,
        queue: job.queue,
        attempts: job.attempts,
        maxAttempts: job.maxAttempts,
        exception: job.exception,
        failedAt: job.failedAt.toISOString(),
      })),
    }

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...config.headers,
    }

    // Add signature if secret is provided
    if (config.secret) {
      const body = JSON.stringify(payload)
      const signature = await this.generateSignature(body, config.secret)
      headers['X-Signature'] = signature
    }

    try {
      await fetch(config.url, {
        method: 'POST',
        headers,
        body: JSON.stringify(payload),
      })
    }
    catch (error) {
      log.error('Failed to send webhook notification:', error)
    }
  }

  /**
   * Generate HMAC signature
   */
  private async generateSignature(payload: string, secret: string): Promise<string> {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign'],
    )

    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))

    return Array.from(new Uint8Array(signature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('')
  }

  /**
   * Log failures to application log
   */
  private logFailures(jobs: FailedJobInfo[]): void {
    for (const job of jobs) {
      log.error(`[Queue] Job "${job.name}" failed on queue "${job.queue}" after ${job.attempts} attempts: ${job.exception}`)
    }
  }

  /**
   * Cleanup resources
   */
  cleanup(): void {
    if (this.batchTimeout) {
      clearTimeout(this.batchTimeout)
      this.batchTimeout = null
    }

    // Flush any remaining batch
    if (this.pendingBatch.length > 0) {
      this.flushBatch()
    }
  }
}

// Global notifier instance
let globalNotifier: FailedJobNotifier | null = null

/**
 * Configure failed job notifications
 */
export function configureFailedJobNotifications(config: FailedJobNotificationConfig): FailedJobNotifier {
  globalNotifier = new FailedJobNotifier(config)
  return globalNotifier
}

/**
 * Get the global notifier
 */
export function getFailedJobNotifier(): FailedJobNotifier | null {
  return globalNotifier
}

/**
 * Notify about a failed job using the global notifier
 */
export async function notifyJobFailed(job: FailedJobInfo): Promise<void> {
  if (globalNotifier) {
    await globalNotifier.notify(job)
  }
}
