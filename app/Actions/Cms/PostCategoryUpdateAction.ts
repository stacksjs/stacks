import { Action } from '@stacksjs/actions'
import { postCategories } from '@stacksjs/cms'
import { CategoryRequestType } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PostCategory Update',
  description: 'PostCategory Update ORM Action',
  method: 'PATCH',
  async handle(request: CategoryRequestType) {
    const id = request.getParam('id')
    const model = await postCategories.update(id, request)

    return response.json(model)
  },
})
