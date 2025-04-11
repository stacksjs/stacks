import type { AuthorRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Author } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Author Update',
  description: 'Author Update ORM Action',
  method: 'PATCH',
  async handle(request: AuthorRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await Author.findOrFail(id)

    const result = model?.update(request.all())

    return response.json(result)
  },
})
