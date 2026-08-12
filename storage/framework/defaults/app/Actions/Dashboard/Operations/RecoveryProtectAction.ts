import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { appendOperatorEvent } from './control-plane'
import { recoveryEnvironment, recoveryRuntime } from './recovery-runtime'

export default new Action({
  name: 'RecoveryProtectAction',
  description: 'Pins or holds one recovery point against retention cleanup.',
  method: 'PATCH',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const runtime = recoveryRuntime()
    const { controlPlane } = recoveryEnvironment()
    const point = runtime.store.getRecoveryPoint(String(request.getParam('id') || ''))
    if (!point || point.projectId !== controlPlane.project.id)
      return response.json({ message: 'Recovery point not found.' }, 404)
    const input = request.all() as Record<string, unknown>
    if (typeof input.pinned !== 'boolean' && typeof input.held !== 'boolean')
      return response.json({ message: 'Set pinned or held to a boolean value.' }, 422)
    const updated = runtime.store.updateRecoveryPoint(point.id, {
      pinned: typeof input.pinned === 'boolean' ? input.pinned : point.pinned,
      held: typeof input.held === 'boolean' ? input.held : point.held,
    })
    await appendOperatorEvent(request, 'backup.protection_updated', {
      recoveryPointId: point.id,
      pinned: updated.pinned,
      held: updated.held,
    }, point.resourceId)
    return { success: true, recoveryPoint: updated }
  },
})
