import { Action } from '@stacksjs/actions'
import { Job } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'FetchQueuesAction',
  description: 'Fetch all the queues',
  method: 'GET',
  async handle() {
    const queues = await Job.all()

    return response.json(queues)
  },
})
