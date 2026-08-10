import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'GetDownloadCount',
  description: 'Gets the total number of downloads.',
  apiResponse: true,

  async handle() {
    try {
      const row = await db
        .selectFrom('releases')
        .select(db.fn.sum('downloads').as('downloads'))
        .executeTakeFirst() as { downloads?: number | string | null } | undefined
      const downloads = Number(row?.downloads || 0)
      if (!Number.isSafeInteger(downloads) || downloads < 0)
        throw new TypeError('Release download total must be a non-negative integer.')

      return { downloads, source: 'releases.downloads' }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Release download count could not be loaded.', 'GetDownloadCount')
    }
  },
})
