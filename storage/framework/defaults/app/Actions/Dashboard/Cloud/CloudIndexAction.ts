import { Action } from '@stacksjs/actions'
import { tsCloud } from '~/config/cloud'
import { dashboardOperationalError } from '../dashboard-response'
import { getDashboardCloudSnapshot } from './cloud-overview'

export default new Action({
  name: 'CloudIndexAction',
  description: 'Returns configured cloud infrastructure and persisted deployment state.',
  method: 'GET',
  apiResponse: true,
  async handle() {
    try {
      return await getDashboardCloudSnapshot(tsCloud)
    }
    catch (error) {
      return dashboardOperationalError(error, 'Cloud infrastructure could not be loaded.', 'CloudIndexAction')
    }
  },
})
