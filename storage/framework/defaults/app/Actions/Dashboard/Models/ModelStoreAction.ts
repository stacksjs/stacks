import { Action } from '@stacksjs/actions'
import { toSnakeCaseKeys } from '@stacksjs/orm'
import { request } from '@stacksjs/router'
import { modelCreateFields, resolveWritableModel } from './model-write'

function normalizeValue(type: string, value: unknown): unknown {
  if (type === 'number') {
    if (value === '' || value === null || value === undefined)
      return null
    const number = Number(value)
    return Number.isFinite(number) ? number : value
  }
  if (type === 'boolean')
    return value === true || value === 1 || value === '1' || value === 'true' || value === 'on'
  return value
}

function normalizeValidationValue(rule: any, value: unknown): unknown {
  if (typeof value !== 'string')
    return value
  if (rule?.name === 'date') {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
    if (!match)
      return value
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])))
  }
  if (rule?.name === 'datetime') {
    const parsed = new Date(value)
    return Number.isNaN(parsed.getTime()) ? value : parsed
  }
  return value
}

function validateFields(Model: any, data: Record<string, unknown>): Record<string, string[]> {
  const errors: Record<string, string[]> = {}
  for (const [field, definition] of Object.entries(Model?.attributes ?? {}) as Array<[string, any]>) {
    const rule = definition?.validation?.rule
    if (!rule || typeof rule.validate !== 'function')
      continue
    const result = rule.validate(normalizeValidationValue(rule, data[field]))
    if (result?.valid || !Array.isArray(result?.errors))
      continue
    errors[field] = result.errors.map((error: any) =>
      definition?.validation?.message?.[error?.code] ?? error?.message ?? 'Invalid value.',
    )
  }
  return errors
}

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
    const fieldDefinitions = modelCreateFields(resolved.Model)
    const data: Record<string, unknown> = {}

    for (const field of fieldDefinitions) {
      if (!Object.prototype.hasOwnProperty.call(body, field.name))
        continue
      const value = normalizeValue(field.type, body[field.name])
      if (value === '' && !field.required)
        continue
      data[field.name] = value
    }

    if (Object.keys(data).length === 0)
      return { ok: false, error: 'No fillable fields in the request body.' }

    const errors = validateFields(resolved.Model, data)
    if (Object.keys(errors).length > 0)
      return { ok: false, error: 'Validation failed.', errors }

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
