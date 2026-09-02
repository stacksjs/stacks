import { Action } from '@stacksjs/actions'
import { errors } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Error Stats',
  description: 'Fetch error statistics',
  method: 'GET',
  async handle() {
    const stats = await errors.fetchStats()

    return response.json({ data: stats })
  },
})
