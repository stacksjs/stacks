import process from 'node:process'
import type { Server, ServerWebSocket } from 'bun'
import { serverResponse } from '@stacksjs/router'
import { log } from '@stacksjs/logging'
import { retry } from '@stacksjs/utils'

process.on('SIGINT', () => {
  // eslint-disable-next-line no-console
  console.log('Exited using Ctrl-C')
  process.exit()
})

if (process.env.QUEUE_WORKER) {
  if (!process.env.JOB)
    throw new Error('Missing JOB environment variable')

  const jobModule = await import(`./app/Jobs/${process.env.JOB}`)

  log.info('Running job...', process.env.JOB)

  if (typeof jobModule.default.handle === 'function') {
    retry(await jobModule.default.handle(), {
      backoffFactor: process.env.JOB_BACKOFF_FACTOR,
      retries: process.env.JOB_RETRIES,
      initialDelay: process.env.JOB_INITIAL_DELAY,
      jitter: process.env.JOB_JITTER,
    })
  }
  else { throw new TypeError('`handle()` function is undefined') }

  process.exit(0)
}

const development = process.env.APP_ENV?.toLowerCase() !== 'production' && process.env.APP_ENV?.toLowerCase() !== 'prod'

const server = Bun.serve({
  port: 3000,
  development,

  async fetch(request: Request, server: Server): Promise<Response | undefined> {
    // console.log('Request', {
    //   url: request.url,
    //   method: request.method,
    //   headers: request.headers.toJSON(),
    //   body: request.body ? await request.text() : null,
    // })

    if (server.upgrade(request)) {
      // eslint-disable-next-line no-console
      console.log('WebSocket upgraded')
      return
    }

    return serverResponse(request)
  },

  websocket: {
    // eslint-disable-next-line unused-imports/no-unused-vars
    async open(ws: ServerWebSocket): Promise<void> {
      // eslint-disable-next-line no-console
      console.log('WebSocket opened')
    },

    async message(ws: ServerWebSocket, message: string): Promise<void> {
      // eslint-disable-next-line no-console
      console.log('WebSocket message', message)
    },

    async close(ws: ServerWebSocket, code: number, reason?: string): Promise<void> {
      // eslint-disable-next-line no-console
      console.log('WebSocket closed', { code, reason })
    },
  },
})

// eslint-disable-next-line no-console
console.log(`Listening on http://localhost:${server.port} ...`)
