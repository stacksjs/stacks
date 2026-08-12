import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { trackOperatorOperation } from './control-plane'
import { applyMigrationPlan, MigrationOperationError } from './migration-operations'
import { stringValue } from './recovery-input'

export default new Action({
  name: 'MigrationApplyAction',
  description: 'Applies an unchanged, explicitly confirmed model-derived migration plan.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const input = request.all() as Record<string, unknown>
    const revision = stringValue(input.revision)
    const confirmation = stringValue(input.confirmation)
    if (!revision || !confirmation)
      return response.json({ message: 'Plan revision and typed confirmation are required.' }, 422)
    try {
      const tracked = await trackOperatorOperation(request, 'dashboard.migrations.apply', { revision }, () => applyMigrationPlan({ revision, confirmation }))
      return { success: true, ...tracked.result, operation: tracked.operation }
    }
    catch (error) {
      if (error instanceof MigrationOperationError)
        return response.json({ message: error.message }, 409)
      return dashboardOperationalError(error, 'The migration plan could not be applied.', 'MigrationApplyAction')
    }
  },
})
