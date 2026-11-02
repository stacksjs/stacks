import type { Validator } from '@stacksjs/ts-validation'
import type { FieldMessages } from './messages'
import { HttpError } from '@stacksjs/error-handling/http-error'
import { applyFieldMessages } from './messages'
import { objectWithContext } from './object-with-context'
import { beginValidation } from './reporter'

export type ValidationRules = Record<string, Validator<any> | { rule: Validator<any>, message?: FieldMessages }>
export interface RequestLike {
  all?: () => Record<string, unknown> | Promise<Record<string, unknown>>
  jsonBody?: Record<string, unknown>
  formBody?: Record<string, unknown>
  query?: Record<string, unknown>
  params?: Record<string, unknown>
  url?: string
}
export interface ValidateOptions {
  /** Plain records are data. Select request mode for URL/query/params-only adapters. */
  source?: 'data' | 'request'
}

async function gatherRequestInput(source: RequestLike | Record<string, unknown>, options: ValidateOptions): Promise<Record<string, unknown>> {
  if (!source || typeof source !== 'object') throw new HttpError(422, 'Send an input object')
  if (options.source !== 'data' && typeof (source as RequestLike).all === 'function') return await (source as Required<Pick<RequestLike, 'all'>>).all()
  const native = options.source !== 'data' && source instanceof Request
  const adapter = options.source === 'request' || (options.source !== 'data' && (Object.hasOwn(source, 'jsonBody') || Object.hasOwn(source, 'formBody')))
  if (!native && !adapter) return source as Record<string, unknown>
  const request = source as RequestLike
  const input: Record<string, unknown> = Object.create(null)
  if (request.url) {
    try { new URL(request.url).searchParams.forEach((value, key) => { input[key] = value }) }
    catch { throw new HttpError(422, 'Invalid request URL') }
  }
  if (native && !['GET', 'HEAD'].includes(source.method) && source.body !== null) {
    const type = source.headers.get('content-type')?.split(';')[0]?.trim().toLowerCase()
    try {
      if (type === 'application/json' || type?.endsWith('+json')) {
        const body: unknown = await source.json()
        if (!body || typeof body !== 'object' || Array.isArray(body)) throw new Error('Not an object')
        Object.assign(input, body)
      }
      else if (type === 'application/x-www-form-urlencoded' || type === 'multipart/form-data') {
        for (const [key, value] of await source.formData()) input[key] = value
      }
      else throw new Error('Unsupported media type')
    }
    catch { throw new HttpError(422, 'Send a valid request body') }
  }
  for (const values of [request.query, request.jsonBody, request.formBody, request.params]) {
    if (values && typeof values === 'object') Object.assign(input, values)
  }
  return input
}

/** Validate once and return declared, supplied fields only, including nested object shapes. */
export async function validate<T = Record<string, unknown>>(request: RequestLike | Record<string, unknown>, rules: ValidationRules, options: ValidateOptions = {}): Promise<T> {
  beginValidation()
  const input = await gatherRequestInput(request, options)
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new HttpError(422, 'Send an input object')
  const ruleObject: Record<string, Validator<any>> = Object.create(null)
  const messages: Record<string, FieldMessages> = Object.create(null)
  for (const [field, definition] of Object.entries(rules)) {
    if (!definition) continue
    if ('rule' in definition) {
      ruleObject[field] = definition.rule
      if (definition.message) messages[field] = definition.message
    }
    else ruleObject[field] = definition
  }
  const result = objectWithContext(ruleObject).validate(input) as ReturnType<ReturnType<typeof objectWithContext>['validate']> & { value?: unknown }
  if (!result.valid) {
    const errors = result.errors as Record<string, { message: string }[]>
    applyFieldMessages(errors, ruleObject, messages, input)
    throw new HttpError(422, 'Validation failed', { errors: Object.fromEntries(Object.entries(errors).map(([field, entries]) => [field, entries.map(error => error.message)])) })
  }
  return result.value as T
}
