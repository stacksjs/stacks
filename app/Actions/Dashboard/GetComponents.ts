import { Action } from '@stacksjs/actions'
// import { Functions } from '@stacksjs/orm'

export default new Action({
  name: 'GetFunctions',
  description: 'Gets your functions.',
  apiResponse: true,

  async handle() {
    // return Functions.all()
  },
})
