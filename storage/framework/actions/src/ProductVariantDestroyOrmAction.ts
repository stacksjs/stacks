import type { ProductVariantRequestType } from '@stacksjs/orm'
import { Action } from '@stacksjs/actions'

export default new Action({
  name: 'ProductVariant Destroy',
  description: 'ProductVariant Destroy ORM Action',
  method: 'DELETE',
  async handle(request: ProductVariantRequestType) {
    const id = request.getParam('id')

    const model = await ProductVariant.findOrFail(Number(id))

    model.delete()

    return 'Model deleted!'
  },
})
