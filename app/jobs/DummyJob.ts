import { Job } from 'stacks:queue'

export default new Job({
  name: 'Send Welcome Email', // defaults to the file name
  description: 'A demo cron job that runs every 5th minute', // optional
  // `run: 'demo-job'` is another option where `demo-job` refers to ./resources/functions/demo-job.ts
  tries: 3, // defaults to 3, in case of failures
  backoff: 3, // defaults to 3-second delays between retries
  action: 'SendWelcomeEmail',
  // handle: () => { // or `action: () => {`
  //   log.info('This cron job runs every 5th minute')
  // },
})
