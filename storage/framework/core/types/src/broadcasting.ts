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

/**
 * Configuration for a broadcast event
 */
export interface BroadcastEvent {
  /**
   * The channel to broadcast on
   */
  channel?: string

  /**
   * The event name to broadcast
   */
  event?: string

  /**
   * Handle the broadcast event.
   * This method is called before the event is broadcast.
   */
  handle?: (data?: any) => Promise<void>
}
