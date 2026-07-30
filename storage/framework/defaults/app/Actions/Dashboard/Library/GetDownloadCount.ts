import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

export default new Action({
  name: 'GetDownloadCount',
  description: 'Gets the total number of downloads.',
  apiResponse: true,

  async handle() {
    const row = await db
      .selectFrom('releases')
      .select(db.fn.sum('downloads').as('downloads'))
      .executeTakeFirst() as { downloads?: number | string | null } | undefined

    return { downloads: Number(row?.downloads || 0), source: 'releases.downloads' }
  },
})
