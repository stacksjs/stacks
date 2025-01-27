import { Action } from '@stacksjs/actions'
// import { Job } from '@stacksjs/orm'

export default new Action({
  name: 'GetJobs',
  description: 'Gets your jobs.',
  apiResponse: true,

  async handle() {
    // return Job.all()
  },
})
