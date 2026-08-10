import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Deployment } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'GetDeployment',
  description: 'Returns one Deployment model record for the dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isSafeInteger(id) || id <= 0)
      return response.json({ message: 'Deployment id must be a positive integer.' }, 400)

    try {
      const deployment = await Deployment.find(id)
      if (!deployment)
        return response.json({ message: 'Deployment not found.' }, 404)

      return {
        deployment: deployment.toJSON(),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Deployment could not be loaded.', 'GetDeployment')
    }
  },
})
