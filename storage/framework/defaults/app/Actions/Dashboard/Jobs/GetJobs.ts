import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetJobs',
  description: 'Gets your jobs.',
  apiResponse: true,

  async handle() {
    // wip: needs to return the jobs from ./app/Jobs/
  },
})
