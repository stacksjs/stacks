import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Index',
  description: 'WaitlistProduct Index ORM Action',
  method: 'GET',
  async handle() {
    const results = await waitlists.products.fetchAll()

    return response.json(results)
  },
})
