import { Action } from '@stacksjs/actions'
import { pages } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Page Index',
  description: 'Page Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await pages.fetchAll()

    return response.json(results)
  },
})
