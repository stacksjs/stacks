import type { RequestInstance } from '@stacksjs/types'
import { Action } from '@stacksjs/actions'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { response } from '@stacksjs/router'
import { dashboardOperationalError } from '../dashboard-response'
import { prepareModelFields, resolveWritableModel } from './model-write'

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

    const input = request.all()
    const raw = input.fields
    const body = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw as Record<string, unknown> : {}
    const { data, errors } = prepareModelFields(resolved.Model, body)

    if (Object.keys(errors).length > 0)
      return response.json({ message: 'Validation failed.', errors }, 422)
    if (Object.keys(data).length === 0)
      return response.json({ message: 'No fillable fields in the request body.' }, 422)

    try {
      const row = await resolved.Model.create(toSnakeCaseKeys(data))
      const id = row?.id ?? row?.attributes?.id ?? null
      return { ok: true, id }
    }
    catch (error) {
      return dashboardOperationalError(error, 'The model record could not be created.', 'ModelStoreAction', 500)
    }
  },
})
