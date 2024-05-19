import { Action } from '@stacksjs/actions'
// import { Library } from '@stacksjs/orm'

export default new Action({
  name: 'GetFunctions',
  description: 'Gets your functions.',
  apiResponse: true,

  async handle() {
    // return Library.functions()
  },
})
