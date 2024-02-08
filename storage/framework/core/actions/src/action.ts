import type { JobOptions } from '@stacksjs/types'

export class Action {
  name: string
  description: string
  rate: JobOptions['rate']
  tries: JobOptions['tries']
  backoff: JobOptions['backoff']
  enabled: JobOptions['enabled']
  handle: () => Promise<string>

  constructor({ name, description, handle, rate, tries, backoff, enabled }: { name: string, description: string, handle: () => Promise<string>, rate: JobOptions['rate'], tries: JobOptions['tries'], backoff: JobOptions['backoff'], enabled: JobOptions['enabled'] }) {
    this.name = name
    this.description = description
    this.rate = rate
    this.tries = tries
    this.backoff = backoff
    this.enabled = enabled
    this.handle = handle
  }
}
