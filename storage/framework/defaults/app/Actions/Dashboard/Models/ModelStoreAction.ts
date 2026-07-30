import { Action } from '@stacksjs/actions'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { request } from '@stacksjs/router'
import { prepareModelFields, resolveWritableModel } from './model-write'

export default new Action({
  name: 'Dashboard Model Store',
  description: 'Creates one row through a model declared useApi store contract.',
  method: 'POST',
  apiResponse: true,
  async handle(req: {
    getParam?: (name: string) => unknown
    all?: () => Record<string, unknown>
    route?: { params?: { slug?: string } }
  }) {
    const resolved = await resolveWritableModel(String(req?.getParam?.('slug') ?? req?.route?.params?.slug ?? ''), 'store')
    if ('error' in resolved)
      return { ok: false, error: resolved.error }

    const input = (req.all?.() ?? (request as any).all?.() ?? {}) as Record<string, unknown>
    const raw = input.fields
    const body = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw as Record<string, unknown> : {}
    const { data, errors } = prepareModelFields(resolved.Model, body)

    if (Object.keys(errors).length > 0)
      return { ok: false, error: 'Validation failed.', errors }
    if (Object.keys(data).length === 0)
      return { ok: false, error: 'No fillable fields in the request body.' }

    try {
      const row = await resolved.Model.create(toSnakeCaseKeys(data))
      const id = row?.id ?? row?.attributes?.id ?? null
      return { ok: true, id }
    }
    catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) }
    }
  },
})
