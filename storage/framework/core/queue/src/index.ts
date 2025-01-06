import type { JobOptions } from '@stacksjs/types'

export class Job {
  name: JobOptions['name']
  description: JobOptions['description']
  action?: JobOptions['action']
  handle?: JobOptions['handle']
  rate: JobOptions['rate']
  tries: JobOptions['tries']
  backoff: JobOptions['backoff']
  enabled: JobOptions['enabled']

  constructor({ name, description, handle, rate, tries, backoff, action, enabled }: JobOptions) {
    this.name = name
    this.description = description
    this.handle = handle
    this.rate = rate
    this.action = action
    this.tries = tries
    this.backoff = backoff
    this.enabled = enabled
  }
}

export { runJob } from './job'
