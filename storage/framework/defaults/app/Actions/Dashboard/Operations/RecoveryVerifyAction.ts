import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { appendOperatorEvent } from './control-plane'
import { recoveryEnvironment, recoveryRuntime } from './recovery-runtime'

export default new Action({
  name: 'RecoveryVerifyAction',
  description: 'Queues independent verification for one available recovery point.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const runtime = recoveryRuntime()
    const { controlPlane } = recoveryEnvironment()
    const point = runtime.store.getRecoveryPoint(String(request.getParam('id') || ''))
    if (!point || point.projectId !== controlPlane.project.id)
      return response.json({ message: 'Recovery point not found.' }, 404)
    if (point.status !== 'available')
      return response.json({ message: 'Only available recovery points can be verified.' }, 409)
    const job = runtime.coordinator.enqueueVerification(point)
    await appendOperatorEvent(request, 'backup.verification_queued', { recoveryPointId: point.id, backupJobId: job.id }, point.resourceId)
    return response.json({ success: true, job, message: `Verification job ${job.id} was queued.` }, 202)
  },
})
