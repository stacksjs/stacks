import { publishDuePages } from '@stacksjs/cms'
import { log } from '@stacksjs/logging'
import { Job } from '@stacksjs/queue'

/**
 * Flip due `scheduled` CMS pages to `published`.
 *
 * `status: 'scheduled'` + `scheduled_at` is a promise the editor made; this
 * job is what keeps it. Every minute, cheap when nothing is due (one indexed
 * SELECT). Runs via the standard scheduler registration - add it to
 * `app/Scheduler.ts` (`schedule.job('PublishScheduledPages').everyMinute()`),
 * or rely on an app's own registration conventions.
 */
export default new Job({
  name: 'PublishScheduledPages',
  description: 'Publish CMS pages whose scheduled time has arrived',
  queue: 'default',
  tries: 2,
  backoff: [30],

  async handle() {
    const published = await publishDuePages()
    if (published > 0)
      log.info(`[cms] published ${published} scheduled page${published === 1 ? '' : 's'}`)
  },
})
