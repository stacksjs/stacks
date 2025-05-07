export interface BroadcastingOptions {
  /**
   * The default broadcasting driver to use
   */
  driver: 'socket' | 'pusher' | 'bun'

  /**
   * Configuration for the Socket.IO driver
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
}

export type BroadcastingConfig = Partial<BroadcastingOptions>

export interface BroadcastOptions {
  event: string
  handle?: (data?: any) => Promise<{ channel: string, type: 'public' | 'private' | 'presence' } | void>
}

export interface Broadcastable {
  broadcast: () => Promise<void>
  broadcastNow: () => Promise<void>
  onChannel: (channel: string) => this
  toOthers: () => this
  toPresence: () => this
  toPrivate: () => this
}
