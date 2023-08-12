import { type JobOptions } from '@stacksjs/types'

export class Job {
  name: JobOptions['name']
  description: JobOptions['description']
  schedule: JobOptions['schedule']
  run: JobOptions['run']
  tries: JobOptions['tries']
  backoff: JobOptions['backoff']

  constructor({ name, description, schedule, run, tries, backoff }: JobOptions) {
    this.name = name
    this.description = description
    this.schedule = schedule
    this.run = run
    this.tries = tries
    this.backoff = backoff
  }
}
