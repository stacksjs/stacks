import { Action } from '@stacksjs/actions'
import { Author } from '@stacksjs/orm'

export default new Action({
  name: 'AuthorIndexAction',
  description: 'Returns authors data for the dashboard.',
  method: 'GET',
  async handle() {
    const items = await Author.orderBy('created_at', 'desc').limit(50).get()

    return {
      authors: items.map(i => i.toJSON()),
    }
  },
})
