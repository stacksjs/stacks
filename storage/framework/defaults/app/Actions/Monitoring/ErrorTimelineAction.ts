import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import { readErrorTimeline } from './error-provider'

export default new Action({
  name: 'Error Timeline',
  description: 'Fetch error timeline (hourly counts for last 24 hours)',
  method: 'GET',
  async handle() {
    return response.json(await readErrorTimeline())
  },
})
