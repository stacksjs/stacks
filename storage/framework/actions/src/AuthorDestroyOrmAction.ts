import type { AuthorRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Author } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Author Destroy',
  description: 'Author Destroy ORM Action',
  method: 'DELETE',
  async handle(request: AuthorRequestType) {
    const id = request.getParam('id')

    const model = await Author.findOrFail(id)

    model?.delete()

    return response.json({ message: 'Model deleted!' })
  },
})
