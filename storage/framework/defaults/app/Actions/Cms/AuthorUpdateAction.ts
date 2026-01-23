import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { Author } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Author Update',
  description: 'Update an existing author',
  method: 'PATCH',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')
    const author = await Author.find(Number(id))

    if (!author) {
      return response.json({ error: 'Author not found' }, 404)
    }

    const result = await author.update({
      name: request.get('name'),
      email: request.get('email'),
    })

    return response.json(result)
  },
})
