import type { TaggableRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { tags } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Tag Store',
  description: 'Tag Store ORM Action',
  method: 'POST',
  async handle(request: TaggableRequestType) {
    await request.validate()

    const data = {
      name: request.get('name'),
      description: request.get('description'),
      taggable_id: parseInt(request.get('taggable_id')),
      taggable_type: request.get('taggable_type'),
    }

    const model = await tags.store(data)

    return response.json(model)
  },
}) 