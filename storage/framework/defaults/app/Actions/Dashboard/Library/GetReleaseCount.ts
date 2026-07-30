import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

export default new Action({
  name: 'GetReleaseCount',
  description: 'Gets the total number of releases of your library.',
  apiResponse: true,

  async handle() {
    const row = await db
      .selectFrom('releases')
      .select(db.fn.count('id').as('count'))
      .executeTakeFirst() as { count?: number | string } | undefined

    return { count: Number(row?.count || 0) }
  },
})
