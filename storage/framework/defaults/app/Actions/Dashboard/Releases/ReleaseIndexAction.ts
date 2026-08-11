import { Action } from '@stacksjs/actions'
import { Release } from '@stacksjs/orm'
import { dashboardOperationalError } from '../dashboard-response'
import { normalizeReleaseRecord, summarizeReleases } from './release-records'

export default new Action({
  name: 'ReleaseIndexAction',
  description: 'Returns native release records and their recorded totals.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    try {
      const records = await Release.orderByDesc('id').limit(200).get()
      const releases = records.map(normalizeReleaseRecord)

      return {
        releases,
        summary: summarizeReleases(releases),
      }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Release history could not be loaded.', 'ReleaseIndexAction')
    }
  },
})
