import { Action } from '@stacksjs/actions'
import User from '../src/models/User'
import { validateField } from 'index'
import { request } from '@stacksjs/router'

export default new Action({
  name: 'User Store',
  description: 'User Store ORM Action',
  method: 'POST',
  validations: {
    name: {
      rule: schema.string().minLength(3).maxLength(255),
      message: 'test',
    },
  },
  async handle(request: anyRequestType) {
    const model = await User.create(request.all())

    return model
  },
})
  