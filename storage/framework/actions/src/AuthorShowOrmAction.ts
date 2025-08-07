import type { AuthorRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Author } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Author Show',
  description: 'Author Show ORM Action',
  method: 'GET',
  async handle(request: AuthorRequestType) {
    const id = request.getParam('id')

    const model = await Author.findOrFail(id)

    return response.json(model)
  },
})
