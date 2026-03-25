import { Action } from '@stacksjs/actions'
// import { Request } from '@stacksjs/orm'

export default new Action({
  name: 'GetRequests',
  description: 'Gets your requests.',
  apiResponse: true,

  async handle() {
    // return Request.all()
  },
})
