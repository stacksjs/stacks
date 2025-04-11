import type { PostCategoryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { PostCategory } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PostCategory Store',
  description: 'PostCategory Store ORM Action',
  method: 'POST',
  async handle(request: PostCategoryRequestType) {
    await request.validate()
    const model = await PostCategory.create(request.all())

    return response.json(model)
  },
})
