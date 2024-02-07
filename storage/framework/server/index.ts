import process from 'node:process'
import type { Server, ServerWebSocket } from 'bun'
import { serverResponse } from '@stacksjs/router'

if (process.env.QUEUE_WORKER) {
  if (!process.env.JOB)
    throw new Error('Missing JOB environment variable')

  const jobModule = await import('./app/Jobs/DummyJob.ts')
  // eslint-disable-next-line no-console
  console.log('Running job', process.env.JOB)
  await jobModule.default.handle()
  process.exit(0)
}

const server = Bun.serve({
  port: 3000,

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
