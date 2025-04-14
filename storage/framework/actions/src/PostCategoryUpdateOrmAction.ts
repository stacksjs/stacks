import type { Request, response } from '@stacksjs/router'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'PostCategory Update',
  description: 'PostCategory Update ORM Action',
  method: 'PATCH',
  async handle(request: Request) {
    const id = request.getParam('id')
    const model = await PostCategory.findOrFail(id)

    const result = model?.update(request.all())

    return response.json(result)
  },
})
