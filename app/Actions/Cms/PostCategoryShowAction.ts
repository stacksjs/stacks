import { Action } from '@stacksjs/actions'
import { postCategories } from '@stacksjs/cms'
import { CategoryRequestType } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PostCategory Show',
  description: 'PostCategory Show ORM Action',
  method: 'GET',
  async handle(request: CategoryRequestType) {
    const id = request.getParam('id')

    const model = await postCategories.fetchById(id)

    return response.json(model)
  },
})
