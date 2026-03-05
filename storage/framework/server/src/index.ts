import process from 'node:process'
import { log } from '@stacksjs/logging'
import { serverResponse } from '@stacksjs/router'
import { retry } from '@stacksjs/utils'
import type { Server, ServerWebSocket } from 'bun'

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

  log.info('Running job...', jobName)

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

  async fetch(request: Request, server: Server<any>): Promise<Response | undefined> {
    if (server.upgrade(request)) {
      return
    }

    return serverResponse(request)
  },

  websocket: {
    open(_ws: ServerWebSocket): void {
      // WebSocket connection opened
    },

    message(_ws: ServerWebSocket, _message: string): void {
      // WebSocket message received
    },

    close(_ws: ServerWebSocket, _code: number, _reason?: string): void {
      // WebSocket connection closed
    },
  },
})

console.log(`Listening on http://localhost:${server.port} ...`)
