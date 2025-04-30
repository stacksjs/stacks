import { Action } from '@stacksjs/actions'
import { categorizable } from '@stacksjs/cms'
import { CategorizableRequestType } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Category Destroy',
  description: 'Category Destroy ORM Action',
  method: 'DELETE',
  async handle(request: CategorizableRequestType) {
    const id = request.getParam('id')

    const model = await categorizable.destroy(id)

    return response.json(model)
  },
}) 