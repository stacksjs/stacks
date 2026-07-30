import { Action } from '@stacksjs/actions'
import { tsCloud } from '~/config/cloud'
import { getDashboardCloudSnapshot } from '../Cloud/cloud-overview'

export default new Action({
  name: 'ServerIndexAction',
  description: 'Returns configured servers and persisted deployment state.',
  method: 'GET',
  async handle() {
    const snapshot = await getDashboardCloudSnapshot(tsCloud)
    return {
      project: snapshot.project,
      environments: snapshot.environments,
      servers: snapshot.serverDefinitions,
      deployments: snapshot.deployments,
      network: snapshot.resources.filter(resource => resource.category === 'network'),
      events: snapshot.events,
      generatedAt: snapshot.generatedAt,
    }
  },
})
