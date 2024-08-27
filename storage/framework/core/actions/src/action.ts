import type { JobOptions, Nullable } from '@stacksjs/types'
import type { ValidationBoolean, ValidationNumber, ValidationString } from '@stacksjs/validation'

type ValidationKey = string
interface ValidationValue {
  rule: ValidationString | ValidationNumber | ValidationBoolean | Date | Nullable<any>
  message: string
}

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
  handle: (options?: Request) => Promise<any>
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
  validations?: Record<ValidationKey, ValidationValue>
  requestFile?: string
  handle: ActionOptions['handle']

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
  }
}
