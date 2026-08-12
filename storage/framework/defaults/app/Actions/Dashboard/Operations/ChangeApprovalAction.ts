import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { dashboardOperator, operationsControlPlane } from './control-plane'
import { stringValue } from './recovery-input'
import { releaseStore } from './operations-runtime'

export default new Action({
  name: 'ChangeApprovalAction',
  description: 'Approves or rejects a release awaiting operator review.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const body = request.all() as Record<string, unknown>
    const decision = stringValue(body.decision)
    if (!['approved', 'rejected'].includes(decision))
      return response.json({ message: 'Decision must be approved or rejected.' }, 422)
    const store = releaseStore()
    const release = store.get(String(request.getParam('id') || ''))
    if (!release || release.projectId !== operationsControlPlane().project.id)
      return response.json({ message: 'Release approval was not found.' }, 404)
    if (release.status !== 'awaiting_approval')
      return response.json({ message: 'This release is no longer awaiting approval.' }, 409)
    const actor = await dashboardOperator(request)
    const updated = store.approve(release.id, { actorId: actor.id, decision: decision as 'approved' | 'rejected', comment: stringValue(body.comment) || undefined })
    return { success: true, release: updated, approvals: store.approvals(release.id) }
  },
})
