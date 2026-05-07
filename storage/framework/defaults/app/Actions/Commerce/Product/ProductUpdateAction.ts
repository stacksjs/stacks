import { Action } from '@stacksjs/actions'
import { products } from '@stacksjs/commerce'
import { response } from '@stacksjs/router'

export default new Action({
  name: 'Product Update',
  description: 'Product Update ORM Action',
  method: 'PATCH',
  async handle(request: RequestInstance) {
    const id = request.getParam('id')
    const data = request.all()

    const model = await products.items.update(id, data)

    return response.json(model)
  },
})
