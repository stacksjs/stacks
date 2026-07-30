import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistRestaurant Update',
  description: 'Updates a restaurant waitlist entry through the native commerce module.',
  method: 'PATCH',
  model: WaitlistRestaurant,
  async handle(request: RequestInstance) {
    await request.validate()

    const id = Number(request.getParam('id'))
    const data = toSnakeCaseKeys(request.all())
    const model = await waitlists.restaurant.update(id, data)

    return response.json(model)
  },
})
