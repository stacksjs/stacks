import { Job } from '@stacksjs/queue'
import { Every } from '@stacksjs/types'

export default new Job({
  name: 'Example Job', // optional, defaults to the file name
  description: 'A demo (cron) job that runs every minute', // optional
  tries: 3, // optional, defaults to 3 retries, in case of failures
  backoff: 3, // optional, defaults to 3-second delays between retries
  rate: Every.Minute, // optional, '* * * * *' in cron syntax
  handle: () => {
    console.log('hello world') // unless triggered via a route.job() call, in which case it logs once
  },
  // action: 'SendWelcomeEmail', // instead of handle, you may target an action or `action: () => {`
})
