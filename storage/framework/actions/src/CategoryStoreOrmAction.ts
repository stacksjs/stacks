import type { CategoryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Category Store',
  description: 'Category Store ORM Action',
  method: 'POST',
  async handle(request: CategoryRequestType) {
    await request.validate()
    const model = await Category.create(request.all())

    return response.json(model)
  },
})
