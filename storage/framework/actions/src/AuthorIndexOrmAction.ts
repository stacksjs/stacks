import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Author Index',
  description: 'Author Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await Author.all()

    return response.json(results)
  },
})
