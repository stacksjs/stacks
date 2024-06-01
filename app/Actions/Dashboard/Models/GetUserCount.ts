import { Action } from '@stacksjs/actions'
// import { User } from '@stacksjs/orm'

export default new Action({
  name: 'GetUserCount',
  description: 'Gets the total number of users.',
  apiResponse: true,

  async handle() {
    // return User.count()
  },
})
