import type { JobOptions } from '@stacksjs/types'

interface ActionOptions {
  name?: string
  description?: string
  handle: () => Promise<any> | any
  rate?: JobOptions['rate']
  tries?: JobOptions['tries']
  backoff?: JobOptions['backoff']
  enabled?: JobOptions['enabled']
}

export class Action {
  name?: string
  description?: string
  rate?: JobOptions['rate']
  tries?: JobOptions['tries']
  backoff?: JobOptions['backoff']
  enabled?: JobOptions['enabled']
  handle: () => Promise<any>

  constructor({ name, description, handle, rate, tries, backoff, enabled }: ActionOptions) {
    this.name = name
    this.description = description
    this.rate = rate
    this.tries = tries
    this.backoff = backoff
    this.enabled = enabled
    this.handle = handle
  }
}
