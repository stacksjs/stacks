import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { deploymentRollbackInput, DeploymentRollbackError, previewDeploymentRollback } from './deployment-rollback'

export default new Action({
  name: 'PreviewDeploymentRollback',
  description: 'Builds and validates a native deployment rollback plan without changing the active release.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance) {
    try {
      return { success: true, plan: await previewDeploymentRollback(deploymentRollbackInput(request.all() as Record<string, unknown>)) }
    }
    catch (error) {
      if (error instanceof DeploymentRollbackError)
        return response.json({ message: error.message }, 409)
      return dashboardOperationalError(error, 'Deployment rollback could not be previewed.', 'PreviewDeploymentRollback')
    }
  },
})
