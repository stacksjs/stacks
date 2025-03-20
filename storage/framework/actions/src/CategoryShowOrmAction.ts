import type { CategoryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Category Show',
  description: 'Category Show ORM Action',
  method: 'GET',
  async handle(request: CategoryRequestType) {
    const id = request.getParam('id')

    const model = await Category.findOrFail(Number(id))

    return response.json(model)
  },
})
