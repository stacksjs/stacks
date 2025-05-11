import type { RealtimeConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **Realtime Configuration**
 *
 * This configuration defines all of your realtime options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 */
export default {
  driver: env.BROADCAST_DRIVER || 'socket',

  socket: {
    port: env.BROADCAST_PORT || 6001,
    host: env.BROADCAST_HOST || 'localhost',
    cors: {
      origin: env.BROADCAST_CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  },

  pusher: {
    appId: env.PUSHER_APP_ID || '',
    key: env.PUSHER_APP_KEY || '',
    secret: env.PUSHER_APP_SECRET || '',
    cluster: env.PUSHER_APP_CLUSTER || 'mt1',
    useTLS: env.PUSHER_APP_USE_TLS || true,
  },
} satisfies RealtimeConfig
