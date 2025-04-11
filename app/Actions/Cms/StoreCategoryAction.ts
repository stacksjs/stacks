import type { PostCategoryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { postCategories } from '@stacksjs/cms'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'Category Store',
  description: 'Category Store ORM Action',
  method: 'POST',
  async handle(request: PostCategoryRequestType) {
    const model = await postCategories.store(request)

    return response.json(model)
  },
})
