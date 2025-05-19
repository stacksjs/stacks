export interface RealtimeOptions {
  /**
   * The default realtime driver to use
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

export type RealtimeConfig = Partial<RealtimeOptions>

export interface RealtimeInstance {
  event: string
  handle?: (data?: any) => Promise<{ channel: string, type: 'public' | 'private' | 'presence' } | void>
}

export type DriverType = 'socket' | 'pusher' | 'bun' // Add more driver types as needed
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
