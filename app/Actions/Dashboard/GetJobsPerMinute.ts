import { Action } from '@stacksjs/actions'
// import { Job } from '@stacksjs/orm'

export default new Action({
  name: 'GetJobsPerMinute',
  description: 'Gets the jobs per minute of your application.',
  apiResponse: true,

  async handle() {
    // return Job.averagePerMinute()
  },
})
