import { Action } from '@stacksjs/actions'
import { Tag } from '@stacksjs/orm'

export default new Action({
  name: 'TagIndexAction',
  description: 'Returns tags data for the dashboard.',
  method: 'GET',
  async handle() {
    const items = await Tag.orderBy('created_at', 'desc').limit(50).get()

    return {
      tags: items.map(i => i.toJSON()),
    }
  },
})
