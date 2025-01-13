import { Action } from '@stacksjs/actions'
import { response } from '@stacksjs/router'
import Job from '../../../storage/framework/orm/src/models/Job.ts'

export default new Action({
  name: 'FetchQueuesAction',
  description: 'Fetch all the queues',
  method: 'GET',
  async handle() {
    const queues = await Job.all()

    return response.json(queues)
  },
})
