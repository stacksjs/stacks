import { Job } from '@stacksjs/queue'
import { Every } from '@stacksjs/types'
import { HttpError } from '@stacksjs/error-handling'

export default new Job({
  name: 'Example Job', // optional, defaults to the file name
  description: 'A demo (cron) job that runs every minute', // optional
  tries: 3, // optional, defaults to 3 retries, in case of failures
  backoff: 3, // optional, defaults to 3-second delays between retries
  rate: Every.Minute, // optional, '* * * * *' in cron syntax
  backoffConfig: {
    strategy: 'fixed',
    initialDelay: 10000,
  },
  handle: (payload: any) => {
    throw new HttpError(500, 'test')
  },
  // action: 'SendWelcomeEmail', // instead of handle, you may target an action or `action: () => {`
})
