import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'CreateJob',
  description: 'Creates a new job.',
  method: 'POST',
  apiResponse: true,

  async handle() {
    // TODO: replace with Job.create() when available
  },
})
