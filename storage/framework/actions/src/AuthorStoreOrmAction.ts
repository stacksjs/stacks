import type { AuthorRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Author } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Author Store',
  description: 'Author Store ORM Action',
  method: 'POST',
  async handle(request: AuthorRequestType) {
    await request.validate()
    const model = await Author.create(request.all())

    return response.json(model)
  },
})
