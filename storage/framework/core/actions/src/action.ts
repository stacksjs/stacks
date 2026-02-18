import type { JobOptions } from '@stacksjs/types'

interface ActionValidations {
  [key: string]: {
    rule: { validate: (value: unknown) => { valid: boolean, errors?: Array<{ message: string }> } }
    message?: string | Record<string, string>
  }
}

/**
 * Infer the correct RequestInstance type from the model value.
 *
 * When `model: Post` (a defineModel() return), resolves to RequestInstance<typeof Post>
 * with full field narrowing. When `model: 'Post'` (string) or omitted, falls back
 * to bare RequestInstance.
 */
type InferRequest<TModel> =
  TModel extends { _isStacksModel: true }
    ? RequestInstance<TModel>
    : RequestInstance

interface ActionOptions<TModel = string> {
  name?: string
  description?: string
  apiResponse?: boolean
  validations?: ActionValidations
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  rate?: JobOptions['rate']
  tries?: JobOptions['tries']
  backoff?: JobOptions['backoff']
  enabled?: JobOptions['enabled']
  path?: string
  requestFile?: string
  model?: TModel
  handle: (request: InferRequest<TModel>) => Promise<any> | any
}

export class Action<TModel = string> {
  name?: string
  description?: string
  rate?: ActionOptions['rate']
  tries?: ActionOptions['tries']
  backoff?: ActionOptions['backoff']
  enabled?: ActionOptions['enabled']
  path?: ActionOptions['path']
  method?: ActionOptions['method']
  validations?: ActionOptions['validations']
  requestFile?: string
  handle: ActionOptions<TModel>['handle']
  model?: string

  constructor({
    name,
    description,
    validations,
    handle,
    rate,
    tries,
    backoff,
    enabled,
    path,
    method,
    requestFile,
    model,
  }: ActionOptions<TModel>) {
    this.name = name
    this.description = description
    this.validations = validations
    this.rate = rate
    this.tries = tries
    this.backoff = backoff
    this.enabled = enabled
    this.path = path
    this.method = method
    this.handle = handle
    this.requestFile = requestFile

    // Extract model name string for runtime (route generation, etc.)
    if (model && typeof model === 'object' && 'name' in model) {
      this.model = (model as { name: string }).name
    }
    else if (typeof model === 'string') {
      this.model = model
    }
  }
}
