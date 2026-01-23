import { Action } from '@stacksjs/actions'
import { Author } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Author Index',
  description: 'Fetch all authors',
  method: 'GET',
  async handle() {
    const results = await Author.all()

    return response.json(results)
  },
})
