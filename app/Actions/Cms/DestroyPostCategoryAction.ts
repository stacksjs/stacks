import type { PostCategoryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { categories } from '@stacksjs/cms'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Post Category Destroy',
  description: 'Post Category Destroy ORM Action',
  method: 'DELETE',
  async handle(request: PostCategoryRequestType) {
    const id = request.getParam('id')

    const result = await categories.destroy(id)

    return response.json({ success: result })
  },
}) 