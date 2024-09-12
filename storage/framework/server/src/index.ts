import process from 'node:process'
import { log } from '@stacksjs/logging'
import { serverResponse } from '@stacksjs/router'
import { retry } from '@stacksjs/utils'
import type { Server, ServerWebSocket } from 'bun'

process.on('SIGINT', () => {
  console.log('Exited using Ctrl-C')
  process.exit()
})

if (process.env.QUEUE_WORKER) {
  if (!process.env.JOB) throw new Error('Missing JOB environment variable')

  const jobModule = await import(`./app/Jobs/${process.env.JOB?.replace(/\.ts$/, '')}`) // removes a potential .ts extension

  log.info('Running job...', process.env.JOB)

  if (typeof jobModule.default.handle === 'function') {
    retry(await jobModule.default.handle(), {
      backoffFactor: process.env.JOB_BACKOFF_FACTOR,
      retries: process.env.JOB_RETRIES,
      initialDelay: process.env.JOB_INITIAL_DELAY,
      jitter: process.env.JOB_JITTER,
    })
  } else {
    throw new TypeError('`handle()` function is undefined')
  }

  process.exit(0)
}

const development = process.env.APP_ENV?.toLowerCase() !== 'production' && process.env.APP_ENV?.toLowerCase() !== 'prod'

const server = Bun.serve({
  port: 3000,
  development,

  async fetch(request: Request, server: Server): Promise<Response | undefined> {
    if (server.upgrade(request)) {
      console.log('WebSocket upgraded')
      return
    }

    const reqBody = await request.text()

    return serverResponse(request, reqBody)
  },

  websocket: {
    async open(ws: ServerWebSocket): Promise<void> {
      console.log('WebSocket opened')
    },

    async message(ws: ServerWebSocket, message: string): Promise<void> {
      console.log('WebSocket message', message)
    },

    async close(ws: ServerWebSocket, code: number, reason?: string): Promise<void> {
      console.log('WebSocket closed', { code, reason })
    },
  },
})

console.log(`Listening on http://localhost:${server.port} ...`)
