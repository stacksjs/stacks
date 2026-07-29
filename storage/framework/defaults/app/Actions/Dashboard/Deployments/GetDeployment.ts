import { Action } from '@stacksjs/actions'
import { Deployment } from '@stacksjs/orm'

export default new Action({
  name: 'GetDeployment',
  description: 'Returns one Deployment model record for the dashboard.',
  method: 'GET',
  apiResponse: true,

  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    if (!Number.isFinite(id) || id <= 0)
      return { deployment: null }

    try {
      const deployment = await Deployment.find(id)
      return {
        deployment: deployment ? deployment.toJSON() : null,
      }
    }
    catch {
      return { deployment: null }
    }
  },
})
