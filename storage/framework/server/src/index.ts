import process from 'node:process'
import { log } from '@stacksjs/logging/runtime'
import { serverResponse } from '@stacksjs/router/runtime'
import { retry } from '@stacksjs/utils/retry'

// Auto-imports (ORM models + resources/functions) are loaded via preloader
// See: storage/framework/defaults/resources/plugins/preloader.ts

process.on('SIGINT', () => {
  console.log('Exited using Ctrl-C')
  process.exit(0)
})

if (process.env.QUEUE_WORKER) {
  if (!process.env.JOB) throw new Error('Missing JOB environment variable')

  // Sanitize job name to prevent path traversal
  const jobName = process.env.JOB.replace(/\.ts$/, '').replace(/[^a-zA-Z0-9_-]/g, '')
  const jobModule = await import(`./app/Jobs/${jobName}`)

  await log.info('Running job...', jobName)

  if (typeof jobModule.default.handle === 'function') {
    await retry(() => jobModule.default.handle(), {
      backoffFactor: Number(process.env.JOB_BACKOFF_FACTOR) || 2,
      retries: Number(process.env.JOB_RETRIES) || 3,
      initialDelay: Number(process.env.JOB_INITIAL_DELAY) || 1000,
      jitter: process.env.JOB_JITTER === 'true',
    })
  } else {
    throw new TypeError('`handle()` function is undefined')
  }

  process.exit(0)
}

const development = process.env.APP_ENV?.toLowerCase() !== 'production' && process.env.APP_ENV?.toLowerCase() !== 'prod'

const port = Number(process.env.PORT) || 3000

const server = Bun.serve({
  port,
  development,

  // SO_REUSEPORT (Linux) lets a new release's instance bind the same
  // port while the old one still serves — the kernel balances between
  // them — which is what makes zero-downtime deploys possible (ts-cloud
  // starts the new unit, health-gates it, then stops the old one).
  // Deliberately off in dev: there, two servers fighting over one port
  // should fail loudly with EADDRINUSE, not silently split traffic.
  reusePort: !development,

  // No `websocket` here, so Bun cannot upgrade a request: one asking for a
  // websocket is answered like any other, through the router, which 404s an
  // unmatched path. This used to upgrade every such request, on any path and
  // unauthenticated, to handlers that did nothing - an open socket per
  // request, held until the idle timeout, and an entry point a later handler
  // would have inherited without auth (stacksjs/stacks#2864). Realtime runs
  // its own server and authorizes its connections.
  async fetch(request: Request): Promise<Response> {
    return serverResponse(request)
  },
})

// Graceful drain for zero-downtime deploys: when systemd stops the old
// release's instance (SIGTERM), stop accepting new connections but let
// in-flight requests finish; hard-exit after a grace window so a stuck
// keep-alive can't outlive systemd's TimeoutStopSec and get SIGKILLed
// mid-request anyway.
process.on('SIGTERM', () => {
  const graceMs = Number(process.env.SHUTDOWN_GRACE_MS) || 15_000
  setTimeout(() => process.exit(0), graceMs).unref()
  Promise.resolve(server.stop()).then(() => process.exit(0))
})

console.log(`Listening on http://localhost:${server.port} ...`)
