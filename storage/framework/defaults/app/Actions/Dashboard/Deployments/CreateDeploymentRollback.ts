import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { trackOperatorOperation } from '../Operations/control-plane'
import { stringValue } from '../Operations/recovery-input'
import { DeploymentRollbackError, deploymentRollbackInput, executeDeploymentRollback, rollbackAuditPayload } from './deployment-rollback'

export default new Action({
  name: 'CreateDeploymentRollback',
  description: 'Executes a previously reviewed deployment rollback and records the operator action.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const body = request.all() as Record<string, unknown>
    try {
      const input = deploymentRollbackInput(body)
      const tracked = await trackOperatorOperation(request, 'dashboard.deployments.rollback', rollbackAuditPayload(input), () => executeDeploymentRollback(input, stringValue(body.revision), stringValue(body.confirmation)))
      return { success: true, ...tracked.result, operation: tracked.operation }
    }
    catch (error) {
      if (error instanceof DeploymentRollbackError)
        return response.json({ message: error.message }, 409)
      throw error
    }
  },
})
