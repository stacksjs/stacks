import type { CategoryRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Product Category Store',
  description: 'Product Category Store ORM Action',
  method: 'POST',
  async handle(request: CategoryRequestType) {
    const data = request.all()

    const model = await products.categories.store(data)

    return response.json(model)
  },
})
