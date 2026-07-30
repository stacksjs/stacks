import { Action } from '@stacksjs/actions'
import { Deployment } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'GetDeployment',
  description: 'Returns one Deployment model record for the dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isFinite(id) || id <= 0)
      return response.json({ message: 'Deployment id must be a positive number.' }, 422)

    try {
      const deployment = await Deployment.find(id)
      if (!deployment)
        return response.json({ message: 'Deployment not found.' }, 404)

      return {
        deployment: deployment.toJSON(),
      }
    }
    catch (error) {
      return response.json({
        message: error instanceof Error ? error.message : 'Deployment could not be loaded.',
      }, 503)
    }
  },
})
