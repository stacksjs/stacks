import { Action } from '@stacksjs/actions'
import { categorizable } from '@stacksjs/cms'
import { response } from '@stacksjs/router'
import { RequestInstance } from '@stacksjs/types'

export default new Action({
  name: 'Category Store',
  description: 'Category Store ORM Action',
  method: 'POST',
  async handle(request: RequestInstance) {
    // await request.validate()

    const data = {
      name: request.get('name'),
      description: request.get('description'),
      categorizable_type: request.get('categorizable_type'),
    }

    console.log(data)
    const model = await categorizable.store(data)

    return response.json(model)
  },
})
