import { Action } from '@stacksjs/actions'
import { db } from '@stacksjs/database'

export default new Action({
  name: 'GetAverageReleaseTime',
  description: 'Gets the average release time of your library.',
  apiResponse: true,

  async handle() {
    const rows = await db
      .selectFrom('releases')
      .select(['created_at'])
      .whereNotNull('created_at')
      .orderBy('created_at')
      .execute() as unknown as Array<{ created_at: string }>

    const timestamps = rows
      .map(row => new Date(row.created_at).getTime())
      .filter(Number.isFinite)

    if (timestamps.length < 2)
      return { averageSeconds: null, intervals: 0 }

    const elapsed = timestamps.slice(1).reduce((total, value, index) => total + value - timestamps[index]!, 0)
    return {
      averageSeconds: Math.round(elapsed / (timestamps.length - 1) / 1000),
      intervals: timestamps.length - 1,
    }
  },
})
