import type { TaggableRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { tags } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Tag Update',
  description: 'Tag Update ORM Action',
  method: 'PATCH',
  async handle(request: TaggableRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const data = {
      id,
      name: request.get('name'),
      description: request.get('description'),
      taggable_type: request.get('taggable_type'),
    }

    const model = await tags.update(data)

    return response.json(model)
  },
}) 