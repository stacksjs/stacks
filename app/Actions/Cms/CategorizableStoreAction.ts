import { Action } from '@stacksjs/actions'
import { categorizable } from '@stacksjs/cms'
import { CategorizableRequestType } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Category Store',
  description: 'Category Store ORM Action',
  method: 'POST',
  async handle(request: CategorizableRequestType) {
    await request.validate()

    const data = {
      name: request.get('name'),
      description: request.get('description'),
      categorizable_type: request.get('categorizable_type'),
    }

    const model = await categorizable.store(data)

    return response.json(model)
  },
}) 