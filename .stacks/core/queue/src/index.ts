import type { JobOptions } from '@stacksjs/types'

export class Job {
  name: JobOptions['name']
  description: JobOptions['description']
  handle: JobOptions['handle']
  tries: JobOptions['tries']
  backoff: JobOptions['backoff']

  constructor({ name, description, handle, tries, backoff }: JobOptions) {
    this.name = name
    this.description = description
    this.handle = handle
    this.tries = tries
    this.backoff = backoff
  }
}
