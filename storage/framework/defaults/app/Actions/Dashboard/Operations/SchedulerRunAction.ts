import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { trackOperatorOperation } from './control-plane'
import { runScheduledTask, SchedulerOperationError } from './scheduler-operations'

export default new Action({
  name: 'SchedulerRunAction',
  description: 'Runs one registered scheduled task immediately and records the operation.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const name = String(request.getParam('name') || '').trim()
    if (!name)
      return response.json({ message: 'A scheduled task name is required.' }, 422)

    try {
      const tracked = await trackOperatorOperation(
        request,
        'dashboard.scheduler.run',
        { task: name },
        () => runScheduledTask(name),
      )
      return { success: true, ...tracked.result, operation: tracked.operation }
    }
    catch (error) {
      if (error instanceof SchedulerOperationError)
        return response.json({ message: error.message }, error.message.includes('not found') ? 404 : 409)
      return dashboardOperationalError(error, 'The scheduled task could not be run.', 'SchedulerRunAction', 500)
    }
  },
})
