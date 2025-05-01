import type { PageRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { Page } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Page Update',
  description: 'Page Update ORM Action',
  method: 'PATCH',
  async handle(request: PageRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await Page.findOrFail(id)

    const result = model?.update(request.all())

    return response.json(result)
  },
})
