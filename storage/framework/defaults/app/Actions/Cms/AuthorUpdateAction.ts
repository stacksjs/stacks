import { Action } from '@stacksjs/actions/runtime'
import { Author } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Author Update',
  description: 'Update an existing author',
  method: 'PATCH',
  async handle(request: RequestInstance) {
    const id = Number(request.getParam('id'))
    const author = await Author.find(Number(id))

    if (!author) {
      return response.json({ error: 'Author not found' }, 404)
    }

    // Only the fields the request sent: an absent one copied through
    // request.get() reached the query as undefined, which binds NULL and
    // erased the stored value (stacksjs/stacks#3010).
    const result = await author.update(request.only(['name', 'email']))

    return response.json(result)
  },
})
