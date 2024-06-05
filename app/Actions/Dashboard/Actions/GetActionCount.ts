import { Action } from '@stacksjs/actions'
// import { Action as ActionModel } from '@stacksjs/orm'

export default new Action({
  name: 'GetActionCount',
  description: 'Gets the total number of actions.',
  apiResponse: true,

  async handle() {
    // return ActionModel.count()
  },
})
