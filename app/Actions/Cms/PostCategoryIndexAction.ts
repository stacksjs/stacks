import { Action } from '@stacksjs/actions'
import { postCategories } from '@stacksjs/cms'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'PostCategory Index',
  description: 'PostCategory Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await postCategories.fetchAll()

    return response.json(results)
  },
})
