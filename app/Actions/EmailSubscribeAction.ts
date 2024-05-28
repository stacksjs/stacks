import { Action } from '@stacksjs/actions'
import { request } from '@stacksjs/router'
import SubscriberEmail from '../../storage/framework/orm/src/models/SubscriberEmail'
import { validateField } from '@stacksjs/validation'


export default new Action({
  name: 'EmailSubscribeAction',
  description: 'Save emails from subscribe page',
  method: 'POST',
  async handle() {
    // We pass the model name cause how else do we know which fields to validate
    await validateField('SubscriberEmail', request.all())

    const email = request.get('email')

    const model = await SubscriberEmail.create({ email })

    return model
  },
})