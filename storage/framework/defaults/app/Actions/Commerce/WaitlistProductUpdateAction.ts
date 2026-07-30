import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Update',
  description: 'Updates a product waitlist entry through the native commerce module.',
  method: 'PATCH',
  model: WaitlistProduct,
  async handle(request: RequestInstance) {
    await request.validate()

    const id = Number(request.getParam('id'))
    const data = toSnakeCaseKeys(request.all())
    const model = await waitlists.products.update(id, data)

    return response.json(model)
  },
})
