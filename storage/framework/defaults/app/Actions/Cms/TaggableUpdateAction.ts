import type { TaggableRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { tags } from '@stacksjs/cms'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'Tag Update',
  description: 'Tag Update ORM Action',
  method: 'PATCH',
  async handle(request: TaggableRequestType) {
    await request.validate({
      name: {
        rule: schema.string(),
        message: {
          name: 'Name is required',
        },
      },
      description: {
        rule: schema.string(),
        message: {
          description: 'Description is required',
        },
      },
    })

    const id = request.getParam('id')
    const data = {
      id,
      name: request.get('name'),
      description: request.get('description'),
    }

    const model = await tags.update(id, data)

    return response.json(model)
  },
})
