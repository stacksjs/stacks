import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'
import { dashboardOperationalError } from '../dashboard-response'

export default new Action({
  name: 'GetReleaseCount',
  description: 'Gets the total number of releases of your library.',
  apiResponse: true,

  async handle() {
    try {
      const row = await db
        .selectFrom('releases')
        .select(db.fn.count('id').as('count'))
        .executeTakeFirst() as { count?: number | string } | undefined
      const count = Number(row?.count || 0)
      if (!Number.isSafeInteger(count) || count < 0)
        throw new TypeError('Release count must be a non-negative integer.')

      return { count }
    }
    catch (error) {
      return dashboardOperationalError(error, 'Release count could not be loaded.', 'GetReleaseCount')
    }
  },
})
