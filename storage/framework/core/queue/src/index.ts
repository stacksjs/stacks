import type { JobOptions } from '@stacksjs/types'

export class Job {
  name: JobOptions['name']
  description: JobOptions['description']
  action?: JobOptions['action']
  handle?: JobOptions['handle']
  tries: JobOptions['tries']
  backoff: JobOptions['backoff']

  constructor({ name, description, handle, tries, backoff, action }: JobOptions) {
    this.name = name
    this.description = description
    this.handle = handle
    this.action = action
    this.tries = tries
    this.backoff = backoff
  }
}
