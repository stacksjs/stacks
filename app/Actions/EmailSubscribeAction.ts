import { Action } from '@stacksjs/actions'
// import { epmailSubscribeRequest } from '@stacksjs/validation'
import SubscriberEmail from '../../storage/framework/orm/src/models/SubscriberEmail'

export default new Action({
  name: 'EmailSubscribeAction',
  description: 'Save emails from subscribe page',
  method: 'POST',
  async handle(request: any) {
   
    return request.get('email')

    const model = await SubscriberEmail.create({ email })

    return model
  },
})
