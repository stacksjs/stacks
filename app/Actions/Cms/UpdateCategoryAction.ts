import type { PostCategoryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { categories } from '@stacksjs/cms'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Category Update',
  description: 'Category Update ORM Action',
  method: 'PATCH',
  async handle(request: PostCategoryRequestType) {
    const id = request.getParam('id')

    const result = await categories.update(id, request)

    return response.json(result)
  },
}) 