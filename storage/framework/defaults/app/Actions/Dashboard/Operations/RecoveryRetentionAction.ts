import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { appendOperatorEvent } from './control-plane'
import { recoveryRuntime } from './recovery-runtime'

export default new Action({
  name: 'RecoveryRetentionAction',
  description: 'Queues cleanup of expired, unlocked, unheld recovery points.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const jobs = recoveryRuntime().coordinator.enqueueRetention()
    await appendOperatorEvent(request, 'backup.retention_queued', { jobs: jobs.length })
    return response.json({ success: true, jobs, message: `Queued ${jobs.length} retention cleanup job${jobs.length === 1 ? '' : 's'}.` }, 202)
  },
})
