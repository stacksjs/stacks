import { Action } from '@stacksjs/actions'
import { Author } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Author Store',
  description: 'Create a new author',
  method: 'POST',
  async handle(request: RequestInstance) {
    const result = await Author.firstOrCreate(
      { email: request.get('email') },
      {
        name: request.get('name'),
        email: request.get('email'),
      },
    )

    return response.json(result)
  },
})
