import type { PageRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { pages } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Page Destroy',
  description: 'Page Destroy ORM Action',
  method: 'DELETE',
  async handle(request: PageRequestType) {
    const id = request.getParam('id')

    await pages.destroy(id)

    return response.json({ message: 'Page deleted!' })
  },
})
