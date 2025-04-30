import type { TaggableRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { tags } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Tag Destroy',
  description: 'Tag Destroy ORM Action',
  method: 'DELETE',
  async handle(request: TaggableRequestType) {
    const id = request.getParam('id')

    const model = await tags.destroy(id)

    return response.json(model)
  },
})
