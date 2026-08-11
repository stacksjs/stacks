import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { tsCloud } from '~/config/cloud'
import { getDashboardCloudSnapshot } from '../Cloud/cloud-overview'
import { dashboardOperationalError } from '../dashboard-response'
import { resolveDashboardServer } from './server-detail'

export default new Action({
  name: 'ServerShowAction',
  description: 'Returns one configured server or persisted deployment.',
  method: 'GET',
  apiResponse: true,
  async handle(request: RequestInstance) {
    const identifier = request.getParam('id')
    if (!identifier || !/^[A-Za-z0-9:_-]{1,160}$/.test(identifier))
      return response.json({ error: 'A server identifier is required.' }, 400)

    let snapshot
    try {
      snapshot = await getDashboardCloudSnapshot(tsCloud)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Server state could not be loaded.', 'ServerShowAction')
    }
    const detail = resolveDashboardServer(snapshot, identifier)
    if (!detail)
      return response.json({ error: 'Server state was not found.' }, 404)

    return {
      project: snapshot.project,
      ...detail,
      generatedAt: snapshot.generatedAt,
    }
  },
})
