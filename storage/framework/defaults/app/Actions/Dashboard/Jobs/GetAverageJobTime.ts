import { Action } from '@stacksjs/actions'
// import { Job } from '@stacksjs/orm'

export default new Action({
  name: 'GetAverageJobTime',
  description: 'Gets the average job time of your application.',
  apiResponse: true,

  async handle() {
    // return Job.averageDuration()
  },
})
