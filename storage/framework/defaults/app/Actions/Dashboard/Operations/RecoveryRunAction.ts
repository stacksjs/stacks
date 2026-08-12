import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { appendOperatorEvent, dashboardOperator } from './control-plane'
import { recoveryEnvironment, recoveryRuntime } from './recovery-runtime'

export default new Action({
  name: 'RecoveryRunAction',
  description: 'Queues an on-demand run for one configured recovery policy.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const runtime = recoveryRuntime()
    const { controlPlane, environment } = recoveryEnvironment()
    const policy = runtime.store.getPolicy(String(request.getParam('id') || ''))
    if (!policy || policy.projectId !== controlPlane.project.id || policy.environmentId !== environment.id)
      return response.json({ message: 'Recovery policy not found.' }, 404)
    if (!policy.enabled)
      return response.json({ message: 'Enable this recovery policy before running it.' }, 409)
    const actor = await dashboardOperator(request)
    const job = runtime.coordinator.enqueueBackup(policy, new Date().toISOString(), actor.id)
    await appendOperatorEvent(request, 'backup.run_queued', { policyId: policy.id, backupJobId: job.id }, policy.resourceId)
    return response.json({ success: true, job, message: `Backup job ${job.id} was queued.` }, 202)
  },
})
