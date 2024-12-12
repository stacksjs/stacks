import { Action } from '@stacksjs/actions'
// import { Request } from '@stacksjs/orm'

export default new Action({
  name: 'GetRequestCount',
  description: 'Gets the total number of requests.',
  apiResponse: true,

  async handle() {
    // return Request.count()
  },
})
