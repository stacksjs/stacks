import type { ExtractParams, InferValidations, JobOptions, RequestInstance } from '@stacksjs/types'

/**
 * Shape of `validations:` on an action. Each entry pairs a
 * ts-validation `Validator<T>` rule with an optional error message.
 *
 * Kept loose at the index-signature level so existing actions with
 * untyped validation objects keep compiling. New code that wants the
 * body-inference benefit (stacksjs/stacks#1851 Phase 2b) declares
 * validations `as const` so {@link InferValidations} can read the
 * concrete rule types.
 */
interface ActionValidations {
  [key: string]: {
    rule: { validate: (value: unknown) => { valid: boolean, errors?: Array<{ message: string }> } }
    message?: string | Record<string, string>
  }
}

/**
 * Resolve the body shape (`TFields`) for an action's request:
 *
 *   1. If `model:` is a `defineModel()` return, use its row shape —
 *      preserves the existing model-aware ergonomics.
 *   2. Else if `validations:` is set as a const, infer the body
 *      from each rule's `Validator<T>` output type
 *      (stacksjs/stacks#1851 Phase 2b).
 *   3. Else fall back to `Record<string, any>` — bare-typed action
 *      with no narrowing.
 */
type ResolveBody<TModel, TValidations> =
  TModel extends { _isStacksModel: true }
    ? TModel
    : TValidations extends ActionValidations
      ? InferValidations<TValidations>
      : Record<string, any>

/**
 * Build the request type passed to the action's `handle()`. Combines
 * the body resolution above with path-extracted params from `TPath`
 * (stacksjs/stacks#1851 Phase 2a).
 */
type InferRequest<TModel, TValidations, TPath extends string> =
  TPath extends ''
    ? RequestInstance<ResolveBody<TModel, TValidations>>
    : RequestInstance<ResolveBody<TModel, TValidations>, ExtractParams<TPath>>

interface ActionOptions<
  TModel = string,
  TValidations extends ActionValidations | undefined = undefined,
  TPath extends string = '',
> {
  name?: string
  description?: string
  apiResponse?: boolean
  validations?: TValidations
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  rate?: JobOptions['rate']
  tries?: JobOptions['tries']
  backoff?: JobOptions['backoff']
  enabled?: JobOptions['enabled']
  /**
   * The literal route path this action serves. Declared as a string
   * literal (e.g. `path: '/api/judges/{id}/follow'`) so
   * {@link ExtractParams} can pull the param names out at compile
   * time and narrow `request.params`.
   *
   * Optional — actions registered via `route.get('/path', AnyAction)`
   * pick up the path from the call site, not the action itself.
   * Setting `path:` here is only needed when the action's own param
   * inference matters before registration (rare).
   */
  path?: TPath
  requestFile?: string
  model?: TModel
  handle: (
    request: InferRequest<TModel, TValidations, TPath>,
  ) => Promise<any> | any
}

export class Action<
  TModel = string,
  TValidations extends ActionValidations | undefined = undefined,
  TPath extends string = '',
> {
  name?: string
  description?: string
  apiResponse?: boolean
  rate?: ActionOptions['rate']
  tries?: ActionOptions['tries']
  backoff?: ActionOptions['backoff']
  enabled?: ActionOptions['enabled']
  path?: ActionOptions<TModel, TValidations, TPath>['path']
  method?: ActionOptions['method']
  validations?: ActionOptions['validations']
  requestFile?: string
  handle: ActionOptions<TModel, TValidations, TPath>['handle']
  model?: string

  constructor({
    name,
    description,
    apiResponse,
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
  }: ActionOptions<TModel, TValidations, TPath>) {
    this.name = name
    this.description = description
    this.apiResponse = apiResponse
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
