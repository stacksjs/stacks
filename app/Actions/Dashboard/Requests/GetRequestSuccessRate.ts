import { Action } from '@stacksjs/actions'
// import { Request } from '@stacksjs/orm'

export default new Action({
  name: 'GetRequestSuccessRate',
  description: 'Gets the request success rate of your application.',
  apiResponse: true,

  async handle() {
    // return Request.successRate()
  },
})
