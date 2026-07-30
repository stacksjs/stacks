import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { tsCloud } from '~/config/cloud'
import { getDashboardCloudSnapshot } from '../Cloud/cloud-overview'
import { resolveDashboardServer } from './server-detail'

export default new Action({
  name: 'ServerShowAction',
  description: 'Returns one configured server or persisted deployment.',
  method: 'GET',
  apiResponse: true,
  async handle(request) {
    const identifier = String(
      (request as any)?.params?.id
      ?? (request as any)?.param?.('id')
      ?? '',
    )
    if (!identifier)
      return response.json({ error: 'A server identifier is required.' }, 400)

    const snapshot = await getDashboardCloudSnapshot(tsCloud)
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
