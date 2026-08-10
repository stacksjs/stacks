import { Action } from '@stacksjs/actions'
import { tsCloud } from '~/config/cloud'
import { dashboardOperationalError } from '../dashboard-response'
import { getDashboardCloudSnapshot } from './cloud-overview'

export default new Action({
  name: 'ServerlessIndexAction',
  description: 'Returns serverless services derived from environment application manifests.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      const snapshot = await getDashboardCloudSnapshot(tsCloud)
      return {
        project: snapshot.project,
        environments: snapshot.environments.filter(environment => environment.serverless),
        services: snapshot.serverlessServices,
        links: snapshot.serverlessLinks,
        events: snapshot.events.filter(event => event.service.toLowerCase().includes('serverless')),
        generatedAt: snapshot.generatedAt,
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Serverless infrastructure could not be loaded.', 'ServerlessIndexAction')
    }
  },
})
