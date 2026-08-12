import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { trackOperatorOperation } from './control-plane'
import { SchedulerOperationError, setScheduledTaskEnabled } from './scheduler-operations'

export default new Action({
  name: 'SchedulerToggleAction',
  description: 'Persists the active state of one scheduled task and records the operation.',
  method: 'PATCH',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const name = String(request.getParam('name') || '').trim()
    const enabled = request.get<unknown>('enabled')
    if (!name)
      return response.json({ message: 'A scheduled task name is required.' }, 422)
    if (typeof enabled !== 'boolean')
      return response.json({ message: 'The enabled field must be a boolean.' }, 422)

    try {
      const tracked = await trackOperatorOperation(
        request,
        `dashboard.scheduler.${enabled ? 'enable' : 'disable'}`,
        { enabled, task: name },
        () => setScheduledTaskEnabled(name, enabled),
      )
      return { success: true, ...tracked.result, operation: tracked.operation }
    }
    catch (error) {
      if (error instanceof SchedulerOperationError)
        return response.json({ message: error.message }, error.message.includes('not found') ? 404 : 409)
      return dashboardOperationalError(error, 'The scheduled task could not be updated.', 'SchedulerToggleAction', 500)
    }
  },
})
