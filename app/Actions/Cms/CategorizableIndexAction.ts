import { Action } from '@stacksjs/actions'
import { categorizable } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Category Index',
  description: 'Category Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await categorizable.fetchAll()

    return response.json(results)
  },
})
