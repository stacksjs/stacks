import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'GetRecentCommits',
  description: 'Gets recent commits.',
  method: 'GET',
  apiResponse: true,

  async handle() {
    // TODO: replace with model query when Commit model is available
    return { commits: [] }
  },
})
