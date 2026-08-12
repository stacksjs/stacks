import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { dashboardOperator, operationsControlPlane, trackOperatorOperation } from './control-plane'
import { stringValue } from './recovery-input'
import { alertStore } from './operations-runtime'

export default new Action({
  name: 'IncidentUpdateAction',
  description: 'Acknowledges, assigns, or silences a native application alert.',
  method: 'PATCH',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const body = request.all() as Record<string, unknown>
    const action = stringValue(body.action)
    if (!['acknowledge', 'assign_self', 'unassign', 'silence'].includes(action))
      return response.json({ message: 'Unsupported incident action.' }, 422)
    const store = alertStore()
    const alert = store.getAlert(String(request.getParam('id') || ''))
    if (!alert || alert.projectId !== operationsControlPlane().project.id)
      return response.json({ message: 'Alert not found.' }, 404)
    const actor = await dashboardOperator(request)
    const tracked = await trackOperatorOperation(request, `dashboard.incidents.${action}`, { alertId: alert.id }, async () => {
      if (action === 'acknowledge') return store.acknowledge(alert.id, actor.id)
      if (action === 'assign_self') return store.assign(alert.id, actor.id, actor.id)
      if (action === 'unassign') return store.assign(alert.id, undefined, actor.id)
      const until = stringValue(body.until)
      if (!until || Number.isNaN(new Date(until).getTime()) || new Date(until) <= new Date())
        throw new Error('A future silence expiry is required.')
      return store.silenceAlert(alert.id, new Date(until).toISOString(), actor.id)
    })
    return { success: true, alert: tracked.result, operation: tracked.operation }
  },
})
