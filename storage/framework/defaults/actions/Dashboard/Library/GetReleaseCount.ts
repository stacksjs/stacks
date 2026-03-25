import { Action } from '@stacksjs/actions'
import { Release } from '@stacksjs/orm'

export default new Action({
  name: 'GetReleaseCount',
  description: 'Gets the total number of releases of your library.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const count = await Release.count()
    return { count }
  },
})
