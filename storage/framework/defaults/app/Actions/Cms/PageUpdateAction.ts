import type { PageRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { pages } from '@stacksjs/cms'
import { formatDate } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Page Update',
  description: 'Page Update ORM Action',
  method: 'PATCH',
  model: 'Page',
  async handle(request: PageRequestType) {
    await request.validate()

    const id = request.getParam('id')

    const data = {
      title: request.get('title'),
      template: request.get('template'),
      content: request.get('content'),
      updated_at: formatDate(new Date()),
    }

    const model = await pages.update(id, data)

    return response.json(model)
  },
})
