import { Action } from '@stacksjs/actions'
import { Job } from '@stacksjs/orm'

export default new Action({
  name: 'GetJobs',
  description: 'Gets your jobs.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    const items = await Job.orderBy('created_at', 'desc').limit(50).get()

    return {
      jobs: items.map(i => i.toJSON()),
    }
  },
})
