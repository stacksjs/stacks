import { Action } from '@stacksjs/actions'
import { Release } from '@stacksjs/orm'

export default new Action({
  name: 'ReleaseIndexAction',
  description: 'Returns the list of releases with download stats.',
  method: 'GET',
  async handle() {
    const items = await Release.orderBy('created_at', 'desc').limit(50).get()

    return {
      data: items.map(i => i.toJSON()),
      stats: {
        labels: [],
        downloads: [],
        releaseTimes: [],
      },
    }
  },
})
