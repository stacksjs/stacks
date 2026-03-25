import { Action } from '@stacksjs/actions'
import { Release } from '@stacksjs/orm'

export default new Action({
  name: 'GetReleases',
  description: 'Gets your releases.',
  method: 'GET',

  async handle() {
    const items = await Release.orderBy('created_at', 'desc').limit(50).get()

    return {
      releases: items.map(i => i.toJSON()),
    }
  },
})
