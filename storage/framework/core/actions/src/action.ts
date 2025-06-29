import type { JobOptions } from '@stacksjs/types'
import type { schema } from '@stacksjs/validation'

interface ActionValidations {
  [key: string]: {
    rule: ReturnType<typeof schema.string>
    message?: string | Record<string, string>
  }
}

type Request = any
interface ActionOptions {
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
  model?: string
  handle: (options?: Request) => Promise<any> | string | number | boolean
}

export class Action {
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
  handle: ActionOptions['handle']
  model?: ActionOptions['model']
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
  }: ActionOptions) {
    // log.debug(`Action ${name} created`) // TODO: this does not yet work because the cloud does not yet have proper file system (efs) access

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
    this.model = model
  }
}
