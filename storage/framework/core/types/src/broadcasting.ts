export interface BroadcastingOptions {
  /**
   * The default broadcasting driver to use
   */
  driver: 'socket' | 'pusher'

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
