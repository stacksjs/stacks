import { Action } from '@stacksjs/actions'
import { tags } from '@stacksjs/cms'
import { response } from '@stacksjs/router'
import { schema } from '@stacksjs/validation'

export default new Action({
  name: 'Tag Update',
  description: 'Tag Update ORM Action',
  method: 'PATCH',
  async handle(request: RequestInstance) {
    /*
     * PATCH, so these are NOT required: a partial update sends the fields it
     * means to change. The messages used to say "X is required", which fires on
     * a type failure and never on absence - a message describing a rule the
     * block does not have.
     */
    await request.validate({
      name: {
        rule: schema.string(),
        message: {
          name: 'Name must be a string.',
        },
      },
      description: {
        rule: schema.string(),
        message: {
          description: 'Description must be a string.',
        },
      },
    })

    const id = Number(request.getParam('id'))
    const data = {
      id,
      name: request.get('name'),
      description: request.get('description'),
    }

    const model = await tags.update(data)

    return response.json(model)
  },
})
