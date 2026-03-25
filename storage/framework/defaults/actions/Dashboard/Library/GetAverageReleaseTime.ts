import { Action } from '@stacksjs/actions'
import { Release } from '@stacksjs/orm'

export default new Action({
  name: 'GetAverageReleaseTime',
  description: 'Gets the average release time of your library.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const count = await Release.count()

    return {
      averageReleaseTime: '-',
      totalReleases: count,
    }
  },
})
