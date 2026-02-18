import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductVariant Update',
  description: 'ProductVariant Update ORM Action',
  method: 'PATCH',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')

    const result = await products.variants.update(id, request)

    return response.json(result)
  },
})
