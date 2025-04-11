import type { PostCategoryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { PostCategory } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PostCategory Update',
  description: 'PostCategory Update ORM Action',
  method: 'PATCH',
  async handle(request: PostCategoryRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await PostCategory.findOrFail(id)

    const result = model?.update(request.all())

    return response.json(result)
  },
})
