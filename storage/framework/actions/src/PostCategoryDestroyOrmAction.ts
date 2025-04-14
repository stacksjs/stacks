import type { Request } from '@stacksjs/router'
import { Action } from '@stacksjs/actions'
import { postCategories } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PostCategory Destroy',
  description: 'PostCategory Destroy ORM Action',
  method: 'DELETE',
  async handle(request: Request) {
    const id = request.getParam('id')

    await postCategories.destroy(id)

    return response.json({ message: 'Model deleted!' })
  },
})
