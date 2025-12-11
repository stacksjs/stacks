/**
 * Realtime deployment mode
 * - 'serverless': Uses API Gateway WebSocket + Lambda + DynamoDB
 * - 'server': Uses ts-broadcasting Bun WebSocket server (ECS/Fargate)
 */
export type RealtimeMode = 'serverless' | 'server'

/**
 * Redis adapter configuration for horizontal scaling
 */
export interface RealtimeRedisConfig {
  enabled?: boolean
  host?: string
  port?: number
  password?: string
  prefix?: string
  cluster?: boolean
  sentinels?: Array<{ host: string, port: number }>
  sentinelName?: string
}

/**
 * Rate limiting configuration
 */
export interface RealtimeRateLimitConfig {
  enabled?: boolean
  maxConnectionsPerIp?: number
  maxMessagesPerSecond?: number
  maxPayloadSize?: number
  banDuration?: number
}

/**
 * Encryption configuration
 */
export interface RealtimeEncryptionConfig {
  enabled?: boolean
  algorithm?: 'aes-256-gcm' | 'chacha20-poly1305'
  keyRotationInterval?: number
}

/**
 * Webhook configuration
 */
export interface RealtimeWebhooksConfig {
  enabled?: boolean
  url?: string
  events?: Array<'connection' | 'disconnection' | 'subscription' | 'message' | 'error'>
  headers?: Record<string, string>
  timeout?: number
  retries?: number
}

/**
 * Queue integration configuration
 */
export interface RealtimeQueueConfig {
  enabled?: boolean
  driver?: 'redis' | 'sqs' | 'memory'
  batchSize?: number
  flushInterval?: number
}

/**
 * Load management configuration
 */
export interface RealtimeLoadConfig {
  maxConnections?: number
  backpressureThreshold?: number
  messageQueueSize?: number
  gracefulShutdownTimeout?: number
}

/**
 * Presence channel configuration
 */
export interface RealtimePresenceConfig {
  enabled?: boolean
  maxMembersPerChannel?: number
  memberInfoTtl?: number
}

/**
 * Server mode configuration (ts-broadcasting)
 */
export interface RealtimeServerConfig {
  /**
   * Server host
   */
  host?: string

  /**
   * Server port
   */
  port?: number

  /**
   * WebSocket scheme
   */
  scheme?: 'ws' | 'wss'

  /**
   * Server driver
   */
  driver?: 'bun' | 'reverb' | 'pusher' | 'ably'

  /**
   * Redis adapter for horizontal scaling
   */
  redis?: RealtimeRedisConfig

  /**
   * Rate limiting configuration
   */
  rateLimit?: RealtimeRateLimitConfig

  /**
   * Encryption configuration
   */
  encryption?: RealtimeEncryptionConfig

  /**
   * Webhook configuration
   */
  webhooks?: RealtimeWebhooksConfig

  /**
   * Queue integration
   */
  queue?: RealtimeQueueConfig

  /**
   * Load management
   */
  loadManagement?: RealtimeLoadConfig

  /**
   * Number of server instances (for container deployment)
   */
  instances?: number

  /**
   * Auto-scaling configuration
   */
  autoScaling?: {
    min?: number
    max?: number
    targetCPU?: number
    targetMemory?: number
  }

  /**
   * Health check configuration
   */
  healthCheck?: {
    enabled?: boolean
    path?: string
    interval?: number
  }

  /**
   * Metrics configuration
   */
  metrics?: {
    enabled?: boolean
    port?: number
    path?: string
  }

  /**
   * TLS configuration
   */
  tls?: {
    enabled?: boolean
    cert?: string
    key?: string
  }
}

/**
 * Serverless mode configuration
 */
export interface RealtimeServerlessConfig {
  /**
   * Connection timeout in seconds
   */
  connectionTimeout?: number

  /**
   * Idle timeout in seconds
   */
  idleTimeout?: number

  /**
   * API Gateway stage name
   */
  stageName?: string

  /**
   * Lambda memory size
   */
  memorySize?: number

  /**
   * Lambda timeout
   */
  timeout?: number

  /**
   * Lambda provisioned concurrency
   */
  provisionedConcurrency?: number
}

/**
 * Channel configuration
 */
export interface RealtimeChannelsConfig {
  /**
   * Enable public channels
   */
  public?: boolean

  /**
   * Enable private channels
   */
  private?: boolean

  /**
   * Enable presence channels
   */
  presence?: boolean | RealtimePresenceConfig
}

export interface RealtimeOptions {
  /**
   * Enable realtime functionality
   */
  enabled?: boolean

  /**
   * Deployment mode: 'serverless' (API Gateway) or 'server' (ts-broadcasting)
   */
  mode?: RealtimeMode

  /**
   * The default realtime driver to use (for backward compatibility)
   */
  driver?: 'socket' | 'pusher' | 'bun' | 'reverb' | 'ably'

  /**
   * Server mode configuration (ts-broadcasting)
   */
  server?: RealtimeServerConfig

  /**
   * Serverless mode configuration (API Gateway WebSocket)
   */
  serverless?: RealtimeServerlessConfig

  /**
   * Channel configuration
   */
  channels?: RealtimeChannelsConfig

  /**
   * Configuration for the Socket.IO driver (legacy)
   */
  socket?: {
    /**
     * The port to run the Socket.IO server on
     */
    port?: number

    /**
     * The host to run the Socket.IO server on
     */
    host?: string

    /**
     * CORS configuration
     */
    cors?: {
      origin: string | string[]
      methods: string[]
    }
  }

  /**
   * Configuration for the Pusher driver
   */
  pusher?: {
    /**
     * Pusher app ID
     */
    appId: string

    /**
     * Pusher key
     */
    key: string

    /**
     * Pusher secret
     */
    secret: string

    /**
     * Pusher cluster
     */
    cluster?: string

    /**
     * Whether to use TLS
     */
    useTLS?: boolean
  }

  /**
   * Application credentials (for Pusher-compatible servers)
   */
  app?: {
    id?: string
    key?: string
    secret?: string
  }

  /**
   * Custom domain for WebSocket endpoint
   */
  domain?: string

  /**
   * Debug mode
   */
  debug?: boolean
}

export type RealtimeConfig = Partial<RealtimeOptions>

export interface RealtimeInstance {
  event: string
  handle?: (data?: any) => Promise<{ channel: string, type: 'public' | 'private' | 'presence' } | void>
}

export type DriverType = 'socket' | 'pusher' | 'bun' | 'reverb' | 'ably'
export type ChannelType = 'public' | 'private' | 'presence'

export interface RealtimeDriver {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  subscribe: (channel: string, callback: (data: any) => void) => void
  unsubscribe: (channel: string) => void
  publish: (channel: string, data: any) => void
  broadcast: (channel: string, event: string, data?: any, type?: ChannelType) => void
  isConnected: () => boolean
}

export interface Broadcastable {
  broadcastEvent: () => Promise<void>
  broadcastEventNow: () => Promise<void>
  setChannel: (channel: string) => this
  excludeCurrentUser: () => this
  setPresenceChannel: () => this
  setPrivateChannel: () => this
}

export interface BroadcastInstance {
  channel?: string
  event?: string
  handle?: (data: any) => Promise<void>
}

/**
 * Realtime configuration presets for common use cases
 */
export const RealtimePresets = {
  /**
   * Server mode presets (ts-broadcasting)
   */
  server: {
    /**
     * Development preset - minimal config, debug enabled
     */
    development: {
      enabled: true,
      mode: 'server' as const,
      debug: true,
      server: {
        host: 'localhost',
        port: 6001,
        scheme: 'ws' as const,
        driver: 'bun' as const,
        rateLimit: { enabled: false },
        healthCheck: { enabled: true, path: '/health' },
      },
      channels: { public: true, private: true, presence: true },
    },

    /**
     * Production preset - optimized for production workloads
     */
    production: {
      enabled: true,
      mode: 'server' as const,
      debug: false,
      server: {
        host: '0.0.0.0',
        port: 6001,
        scheme: 'wss' as const,
        driver: 'bun' as const,
        redis: { enabled: true, prefix: 'stacks:realtime:' },
        rateLimit: {
          enabled: true,
          maxConnectionsPerIp: 100,
          maxMessagesPerSecond: 50,
          maxPayloadSize: 65536,
        },
        loadManagement: {
          maxConnections: 10000,
          backpressureThreshold: 1000,
          messageQueueSize: 10000,
          gracefulShutdownTimeout: 30000,
        },
        autoScaling: { min: 2, max: 10, targetCPU: 70 },
        healthCheck: { enabled: true, path: '/health', interval: 30 },
        metrics: { enabled: true, port: 9090, path: '/metrics' },
      },
      channels: { public: true, private: true, presence: true },
    },

    /**
     * High performance preset - optimized for high throughput
     */
    highPerformance: {
      enabled: true,
      mode: 'server' as const,
      server: {
        driver: 'bun' as const,
        redis: { enabled: true, cluster: true },
        rateLimit: {
          enabled: true,
          maxConnectionsPerIp: 500,
          maxMessagesPerSecond: 200,
          maxPayloadSize: 131072,
        },
        loadManagement: {
          maxConnections: 100000,
          backpressureThreshold: 5000,
          messageQueueSize: 50000,
          gracefulShutdownTimeout: 60000,
        },
        autoScaling: { min: 4, max: 50, targetCPU: 60 },
      },
    },

    /**
     * Chat application preset
     */
    chat: {
      enabled: true,
      mode: 'server' as const,
      server: {
        driver: 'bun' as const,
        redis: { enabled: true },
        rateLimit: {
          enabled: true,
          maxConnectionsPerIp: 10,
          maxMessagesPerSecond: 20,
        },
        loadManagement: { maxConnections: 50000 },
      },
      channels: {
        public: true,
        private: true,
        presence: { enabled: true, maxMembersPerChannel: 500, memberInfoTtl: 60 },
      },
    },

    /**
     * Gaming preset - low latency, high throughput
     */
    gaming: {
      enabled: true,
      mode: 'server' as const,
      server: {
        driver: 'bun' as const,
        redis: { enabled: true, cluster: true },
        rateLimit: {
          enabled: true,
          maxConnectionsPerIp: 50,
          maxMessagesPerSecond: 100,
        },
        loadManagement: {
          maxConnections: 50000,
          backpressureThreshold: 2000,
          messageQueueSize: 20000,
        },
        autoScaling: { min: 2, max: 20, targetCPU: 50 },
      },
      channels: { public: true, private: true, presence: true },
    },
  },

  /**
   * Serverless mode presets (API Gateway WebSocket)
   */
  serverless: {
    /**
     * Development preset
     */
    development: {
      enabled: true,
      mode: 'serverless' as const,
      debug: true,
      serverless: {
        connectionTimeout: 3600,
        idleTimeout: 600,
        stageName: 'dev',
        memorySize: 256,
        timeout: 30,
      },
      channels: { public: true, private: true, presence: true },
    },

    /**
     * Production preset
     */
    production: {
      enabled: true,
      mode: 'serverless' as const,
      debug: false,
      serverless: {
        connectionTimeout: 3600,
        idleTimeout: 600,
        stageName: 'production',
        memorySize: 512,
        timeout: 30,
        provisionedConcurrency: 2,
      },
      channels: { public: true, private: true, presence: true },
    },

    /**
     * Notifications preset - simple push notifications
     */
    notifications: {
      enabled: true,
      mode: 'serverless' as const,
      serverless: {
        connectionTimeout: 7200,
        idleTimeout: 1800,
        memorySize: 256,
        timeout: 15,
      },
      channels: { public: true, private: true, presence: false },
    },
  },
} as const
