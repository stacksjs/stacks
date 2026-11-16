import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions/runtime'
import { response } from '@stacksjs/router'
import { formFields, rowRefusalResponse, storeModelRow } from './model-row-writes'
import { resolveWritableModel } from './model-write'

interface ModelWriteInput {
  fields?: unknown
}

export default new Action({
  name: 'Dashboard Model Store',
  description: 'Creates one row through a model declared useApi store contract.',
  method: 'POST',
  apiResponse: true,
  async handle(request: RequestInstance<ModelWriteInput>) {
    const resolved = await resolveWritableModel(request.getParam('slug'), 'store')
    if ('error' in resolved)
      return response.json({ message: resolved.error }, resolved.status)

    const result = await storeModelRow(resolved, formFields(request.all().fields))
    return result.ok ? { ok: true, id: result.id } : rowRefusalResponse(result)
  },
})
