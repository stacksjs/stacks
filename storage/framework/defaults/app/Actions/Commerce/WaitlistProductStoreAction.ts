import { Action } from '@stacksjs/actions'
import { waitlists } from '@stacksjs/commerce'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'WaitlistProduct Store',
  description: 'Creates a product waitlist entry through the native commerce module.',
  method: 'POST',
  model: WaitlistProduct,
  async handle(request: RequestInstance) {
    await request.validate()

    const data = toSnakeCaseKeys(request.all())
    const model = await waitlists.products.store(data)

    return response.json(model)
  },
})
