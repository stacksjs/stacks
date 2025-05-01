import type { PageRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Page } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Page Destroy',
  description: 'Page Destroy ORM Action',
  method: 'DELETE',
  async handle(request: PageRequestType) {
    const id = request.getParam('id')

    const model = await Page.findOrFail(id)

    model?.delete()

    return response.json({ message: 'Model deleted!' })
  },
})
