import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { deploymentPreviewCommandArgs } from './deployment-input'
import { runDeploymentPreview } from './deployment-preview'

export default new Action({
  name: 'PreviewDeployment',
  description: 'Builds a non-mutating deployment plan from the native Buddy deploy pipeline.',
  method: 'POST',
  apiResponse: true,

  async handle(request: RequestInstance) {
    let args: string[]
    try {
      args = deploymentPreviewCommandArgs({
        environment: request.get('environment') || request.get('env'),
        domain: request.get('domain'),
      })
    }
    catch (error) {
      return response.json({
        success: false,
        message: error instanceof Error ? error.message : 'Deployment preview input is invalid.',
      }, { status: 422 })
    }

    try {
      return {
        success: true,
        plan: await runDeploymentPreview(args),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Deployment preview could not be generated.', 'PreviewDeployment', 500)
    }
  },
})
