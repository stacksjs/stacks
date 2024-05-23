import type { JobOptions, Nullable } from '@stacksjs/types'
import type { ValidationBoolean, ValidationNumber, ValidationString } from '@stacksjs/validation'

type ValidationKey = string
interface ValidationValue {
  rule: ValidationString | ValidationNumber | ValidationBoolean | Date | Nullable<any>
  message: string
}

// TODO: this is temporary and will get auto generated based on ./app/Actions/*
interface Request {
  message: string
  level: 'info' | 'warn' | 'error'
}

interface ActionOptions {
  name?: string
  description?: string
  apiResponse?: boolean
  validations?: Record<ValidationKey, ValidationValue>
  path?: string
  rate?: JobOptions['rate']
  tries?: JobOptions['tries']
  backoff?: JobOptions['backoff']
  enabled?: JobOptions['enabled']
  handle: (request?: Request) => Promise<any> | object | string
}

export class Action {
  name?: string
  description?: string
  rate?: JobOptions['rate']
  tries?: JobOptions['tries']
  backoff?: JobOptions['backoff']
  enabled?: boolean
  validations?: Record<ValidationKey, ValidationValue>
  path?: string
  handle: (request?: Request) => Promise<any> | object | string

  constructor({ name, description, validations, handle, rate, tries, backoff, enabled, path }: ActionOptions) {
    // log.debug(`Action ${name} created`) // TODO: this does not yet work because the cloud does not yet have proper file system (efs) access

    this.name = name
    this.description = description
    this.validations = validations
    this.rate = rate
    this.tries = tries
    this.backoff = backoff
    this.enabled = enabled
    this.path = path
    this.handle = handle
  }
}
