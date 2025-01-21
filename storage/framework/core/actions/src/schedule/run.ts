import { log } from '@stacksjs/logging'
import { runScheduler } from '@stacksjs/scheduler'

const result = await runScheduler()

if (result?.isErr()) {
  console.error(result.error)
  log.error('Schedule run failed', result.error)
}
