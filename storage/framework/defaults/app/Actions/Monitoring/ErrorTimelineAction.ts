import { Action } from '@stacksjs/actions'
import { errors } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Error Timeline',
  description: 'Fetch error timeline (hourly counts for last 24 hours)',
  method: 'GET',
  async handle() {
    const timeline = await errors.fetchTimeline()

    return response.json({ data: timeline })
  },
})
