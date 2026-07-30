import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistRestaurant Store',
  description: 'Creates a restaurant waitlist entry through the native commerce module.',
  method: 'POST',
  model: WaitlistRestaurant,
  async handle(request: RequestInstance) {
    await request.validate()

    const data = toSnakeCaseKeys(request.all())
    const model = await waitlists.restaurant.store(data)

    return response.json(model)
  },
})
