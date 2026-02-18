import { Action } from '@stacksjs/actions'
import { categorizable } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Category Show',
  description: 'Category Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')

    const model = await categorizable.fetchById(id)

    return response.json(model)
  },
})
