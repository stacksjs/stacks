import { Action } from '@stacksjs/actions'

import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductItem Store',
  description: 'ProductItem Store ORM Action',
  method: 'POST',
  model: Product,
  async handle(request: RequestInstance) {
    await request.validate()
    const data = request.all()

    const model = await products.items.store(data)

    return response.json(model)
  },
})
