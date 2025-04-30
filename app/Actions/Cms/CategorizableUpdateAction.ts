import type { CategorizableRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { categorizable } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Category Update',
  description: 'Category Update ORM Action',
  method: 'PATCH',
  async handle(request: CategorizableRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const data = {
      id,
      name: request.get('name'),
      description: request.get('description'),
      categorizable_type: request.get('categorizable_type'),
    }

    const model = await categorizable.update(data)

    return response.json(model)
  },
})
