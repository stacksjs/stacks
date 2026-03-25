import { Action } from '@stacksjs/actions'
import { Job } from '@stacksjs/orm'

export default new Action({
  name: 'JobIndexAction',
  description: 'Returns a paginated list of jobs.',
  method: 'GET',
  async handle() {
    const items = await Job.orderBy('created_at', 'desc').limit(50).get()
    const count = await Job.count()

    return {
      jobs: items.map(i => i.toJSON()),
      stats: [
        { label: 'Total Jobs', value: String(count) },
      ],
    }
  },
})
