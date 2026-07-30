import { Action } from '@stacksjs/actions'
import { tsCloud } from '~/config/cloud'
import { getDashboardCloudSnapshot } from './cloud-overview'

export default new Action({
  name: 'CloudIndexAction',
  description: 'Returns configured cloud infrastructure and persisted deployment state.',
  method: 'GET',
  async handle() {
    return getDashboardCloudSnapshot(tsCloud)
  },
})
