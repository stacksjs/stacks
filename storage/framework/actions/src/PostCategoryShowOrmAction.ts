import type { PostCategoryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { PostCategory } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PostCategory Show',
  description: 'PostCategory Show ORM Action',
  method: 'GET',
  async handle(request: PostCategoryRequestType) {
    const id = request.getParam('id')

    const model = await PostCategory.findOrFail(id)

    return response.json(model)
  },
})
