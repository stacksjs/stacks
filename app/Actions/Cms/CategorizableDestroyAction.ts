import type { CategorizableRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { categorizable } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Category Destroy',
  description: 'Category Destroy ORM Action',
  method: 'DELETE',
  async handle(request: CategorizableRequestType) {
    const id = request.getParam('id')

    await categorizable.destroy(id)

    return response.json({ message: 'Category deleted successfully' })
  },
})
