import type { ProductVariantRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

import { response } from '@stacksjs/router'

export default new Action({
  name: 'ProductVariant Update',
  description: 'ProductVariant Update ORM Action',
  method: 'PATCH',
  async handle(request: ProductVariantRequestType) {
    await request.validate()

    const id = request.getParam('id')
    const model = await ProductVariant.findOrFail(Number(id))

    const result = model.update(request.all())

    return response.json(result)
  },
})
