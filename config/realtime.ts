import type { RealtimeConfig } from '@stacksjs/types'
import { env } from '@stacksjs/env'

/**
 * **Realtime Configuration**
 *
 * This configuration defines all of your realtime options. Because Stacks is fully-typed,
 * you may hover any of the options below and the definitions will be provided. In case
 * you have any questions, feel free to reach out via Discord or GitHub Discussions.
 *
 * Stacks supports two deployment modes:
 * - 'server': Uses ts-broadcasting (high-performance Bun WebSocket server)
 * - 'serverless': Uses API Gateway WebSocket + Lambda + DynamoDB
 */
export default {
  enabled: true,

  // Deployment mode: 'server' (ts-broadcasting) or 'serverless' (API Gateway)
  mode: env.REALTIME_MODE || 'server',

  // Legacy driver option (for backward compatibility)
  driver: env.BROADCAST_DRIVER || 'bun',

  // Server mode configuration (ts-broadcasting)
  server: {
    host: env.BROADCAST_HOST || '0.0.0.0',
    port: env.BROADCAST_PORT || 6001,
    scheme: env.BROADCAST_SCHEME || 'ws',
    driver: 'bun',

    // Redis adapter for horizontal scaling
    redis: {
      enabled: env.BROADCAST_REDIS_ENABLED || false,
      host: env.REDIS_HOST || 'localhost',
      port: env.REDIS_PORT || 6379,
      password: env.REDIS_PASSWORD,
      prefix: env.BROADCAST_REDIS_PREFIX || 'stacks:realtime:',
    },

    // Rate limiting
    rateLimit: {
      enabled: env.BROADCAST_RATE_LIMIT_ENABLED || true,
      maxConnectionsPerIp: 100,
      maxMessagesPerSecond: 50,
      maxPayloadSize: 65536,
      banDuration: 300,
    },

    // Load management
    loadManagement: {
      maxConnections: 10000,
      backpressureThreshold: 1000,
      messageQueueSize: 10000,
      gracefulShutdownTimeout: 30000,
    },

    // Auto-scaling (for cloud deployment)
    autoScaling: {
      min: 1,
      max: 10,
      targetCPU: 70,
    },

    // Health check endpoint
    healthCheck: {
      enabled: true,
      path: '/health',
      interval: 30,
    },

    // Metrics endpoint
    metrics: {
      enabled: env.BROADCAST_METRICS_ENABLED || false,
      port: 9090,
      path: '/metrics',
    },
  },

  // Serverless mode configuration (API Gateway WebSocket)
  serverless: {
    connectionTimeout: 3600,
    idleTimeout: 600,
    stageName: env.APP_ENV || 'production',
    memorySize: 256,
    timeout: 30,
  },

  // Channel configuration
  channels: {
    public: true,
    private: true,
    presence: {
      enabled: true,
      maxMembersPerChannel: 100,
      memberInfoTtl: 60,
    },
  },

  // Application credentials (for Pusher-compatible servers)
  app: {
    id: env.BROADCAST_APP_ID || 'stacks',
    key: env.BROADCAST_APP_KEY || '',
    secret: env.BROADCAST_APP_SECRET || '',
  },

  // Legacy socket configuration
  socket: {
    port: env.BROADCAST_PORT || 6001,
    host: env.BROADCAST_HOST || 'localhost',
    cors: {
      origin: env.BROADCAST_CORS_ORIGIN || '*',
      methods: ['GET', 'POST'],
    },
  },

  // Legacy Pusher configuration
  pusher: {
    appId: env.PUSHER_APP_ID || '',
    key: env.PUSHER_APP_KEY || '',
    secret: env.PUSHER_APP_SECRET || '',
    cluster: env.PUSHER_APP_CLUSTER || 'mt1',
    useTLS: env.PUSHER_APP_USE_TLS || true,
  },

  // Debug mode
  debug: env.BROADCAST_DEBUG || false,
} satisfies RealtimeConfig
