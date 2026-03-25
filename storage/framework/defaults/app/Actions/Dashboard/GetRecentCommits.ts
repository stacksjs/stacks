import { Action } from '@stacksjs/actions'
// import { Commit } from '@stacksjs/orm'

export default new Action({
  name: 'GetRecentCommits',
  description: 'Gets recent commits.',
  apiResponse: true,

  async handle() {
    // use git to get the last 3 commits
    // Commit.recent(3)
  },
})
