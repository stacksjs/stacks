import type { PageRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Page } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Page Show',
  description: 'Page Show ORM Action',
  method: 'GET',
  async handle(request: PageRequestType) {
    const id = request.getParam('id')

    const model = await Page.findOrFail(id)

    return response.json(model)
  },
})
