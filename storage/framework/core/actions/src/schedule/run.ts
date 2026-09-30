import { log } from '@stacksjs/logging'
import { runScheduler } from '@stacksjs/scheduler'
import { injectGlobalAutoImports } from '@stacksjs/server'

// Scheduled jobs are application code: they read the auto-imported globals
// and dispatch events (a model save dispatches `<model>:created`). Boot both
// before the first job runs, the same boot the HTTP server does. Without it
// every listener in app/Events.ts was missing from this process - StatusHQ's
// incident notifications, dispatched from the scheduler, never went out.
await injectGlobalAutoImports()

const result = await runScheduler()

if (result?.isErr) {
  console.error(result.error)
  log.error('Schedule run failed', result.error)
}
