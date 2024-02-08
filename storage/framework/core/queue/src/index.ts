import type { JobOptions } from '@stacksjs/types'

export class Job {
  name: JobOptions['name']
  description: JobOptions['description']
  action?: JobOptions['action']
  handle?: JobOptions['handle']
  rate: JobOptions['rate']
  tries: JobOptions['tries']
  backoff: JobOptions['backoff']

  constructor({ name, description, handle, rate, tries, backoff, action }: JobOptions) {
    this.name = name
    this.description = description
    this.handle = handle
    this.rate = rate
    this.action = action
    this.tries = tries
    this.backoff = backoff
  }
}
