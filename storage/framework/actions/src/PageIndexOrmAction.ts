import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Page Index',
  description: 'Page Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await Page.all()

    return response.json(results)
  },
})
