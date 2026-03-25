import { Action } from '@stacksjs/actions'
import { Page } from '@stacksjs/orm'

export default new Action({
  name: 'PageIndexAction',
  description: 'Returns pages data for the dashboard.',
  method: 'GET',
  async handle() {
    const items = await Page.orderBy('created_at', 'desc').limit(50).get()

    return {
      pages: items.map(i => i.toJSON()),
    }
  },
})
