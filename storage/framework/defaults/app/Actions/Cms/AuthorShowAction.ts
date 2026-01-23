import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Author } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Author Show',
  description: 'Fetch a single author by ID',
  method: 'GET',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')
    const result = await Author.find(Number(id))

    if (!result) {
      return response.json({ error: 'Author not found' }, 404)
    }

    return response.json(result)
  },
})
