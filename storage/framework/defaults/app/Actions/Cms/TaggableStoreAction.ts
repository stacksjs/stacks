import type { TaggableRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { tags } from '@stacksjs/cms'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'Tag Store',
  description: 'Tag Store ORM Action',
  method: 'POST',
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

    const data = {
      name: request.get('name'),
      description: request.get('description'),
      taggable_type: request.get('taggable_type'),
    }

    const model = await tags.store(data)

    return response.json(model)
  },
})
