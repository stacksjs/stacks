import { Action } from '@stacksjs/actions'
import { request } from '@stacksjs/router'
import SubscriberEmail from '../../storage/framework/orm/src/models/SubscriberEmail'

export default new Action({
  name: 'EmailSubscribeAction',
  description: 'Save emails from subscribe oage',
  method: 'POST',
  async handle() {
    const email = request.get('email')

    const model = await SubscriberEmail.create({ email })

    return model
  },
})