import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'ExampleScheduledAction',
  description: 'Store User Data',
  method: 'POST',
  requestFile: 'UserRequest',
  async handle() {
    console.log('test action')
  },
})
