import { Action } from '@stacksjs/actions'
import { Release } from '@stacksjs/orm'
import { normalizeReleaseRecord, summarizeReleases } from './release-records'

export default new Action({
  name: 'ReleaseIndexAction',
  description: 'Returns native release records and their recorded totals.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const records = await Release.orderByDesc('id').limit(200).get()
    const releases = records.map(normalizeReleaseRecord)

    return {
      releases,
      summary: summarizeReleases(releases),
    }
  },
})
