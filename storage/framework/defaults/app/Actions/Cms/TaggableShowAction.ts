import { Action } from '@stacksjs/actions'
import { tags } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Tag Show',
  description: 'Tag Show ORM Action',
  method: 'GET',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')

    const model = await tags.fetchTagById(id)

    return response.json(model)
  },
})
