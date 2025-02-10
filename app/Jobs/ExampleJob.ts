// import { HttpError } from '@stacksjs/error-handling'
import { Job } from '@stacksjs/queue'
import { Every } from '@stacksjs/types'

export default new Job({
  name: 'Example Job', // optional, defaults to the file name
  description: 'A demo (cron) job that runs every minute', // optional
  tries: 3, // optional, defaults to 3 retries, in case of failures
  backoff: 3, // optional, defaults to 3-second delays between retries
  rate: Every.Minute, // optional, '* * * * *' in cron syntax
  backoffConfig: {
    strategy: 'linear',
    initialDelay: 5000,
    factor: 3,
  },
  handle: (payload: any) => {
    return payload
  },
  // action: 'SendWelcomeEmail', // instead of handle, you may target an action or `action: () => {`
})
