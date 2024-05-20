import { Action } from '@stacksjs/actions'
// import { Action as ActionModel } from '@stacksjs/orm'

export default new Action({
  name: 'GetActions',
  description: 'Gets your actions.',
  apiResponse: true,

  async handle() {
    // return ActionModel.all()
  },
})
