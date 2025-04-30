import { Action } from '@stacksjs/actions'
import { tags } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Tag Index',
  description: 'Tag Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await tags.fetchTags()

    return response.json(results)
  },
})
