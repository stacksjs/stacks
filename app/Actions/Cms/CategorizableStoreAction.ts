import type { CategorizableRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { categorizable } from '@stacksjs/cms'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'Category Store',
  description: 'Category Store ORM Action',
  method: 'POST',
  async handle(request: CategorizableRequestType) {
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

      categorizable_type: {
        rule: schema.string(),
        message: {
          categorizable_type: 'Categorizable type is required',
        },
      },
    })
    const data = {
      name: request.get('name'),
      description: request.get('description'),
      categorizable_type: request.get('categorizable_type'),
    }

    const model = await categorizable.store(data)

    return response.json(model)
  },
})
