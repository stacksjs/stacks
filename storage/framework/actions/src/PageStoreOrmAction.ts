import type { PageRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Page } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Page Store',
  description: 'Page Store ORM Action',
  method: 'POST',
  async handle(request: PageRequestType) {
    await request.validate()
    const model = await Page.create(request.all())

    return response.json(model)
  },
})
