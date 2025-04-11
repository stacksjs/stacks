import type { PostCategoryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { PostCategory } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PostCategory Destroy',
  description: 'PostCategory Destroy ORM Action',
  method: 'DELETE',
  async handle(request: PostCategoryRequestType) {
    const id = request.getParam('id')

    const model = await PostCategory.findOrFail(id)

    model?.delete()

    return response.json({ message: 'Model deleted!' })
  },
})
