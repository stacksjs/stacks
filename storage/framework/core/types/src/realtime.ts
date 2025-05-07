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
    /**
     * The channel to broadcast on
     */
    channel?: string
  
    /**
     * The event name to broadcast
     */
    event?: string
  
    /**
     * The type of channel (public, private, presence)
     */
    channelType?: 'public' | 'private' | 'presence'
  
    /**
     * Whether to exclude the current user from the broadcast
     */
    excludeCurrentUser?: boolean
  
    /**
     * Additional data to be passed with the broadcast
     */
    data?: any
  }
  
  export interface BroadcastDriver {
    /**
     * Connect to the broadcasting service
     */
    connect: () => Promise<void>
  
    /**
     * Disconnect from the broadcasting service
     */
    disconnect: () => Promise<void>
  
    /**
     * Subscribe to a channel
     */
    subscribe: (channel: string, callback: (data: any) => void) => void
  
    /**
     * Unsubscribe from a channel
     */
    unsubscribe: (channel: string) => void
  
    /**
     * Broadcast an event to a channel
     */
    broadcast: (channel: string, event: string, data?: any, type?: 'public' | 'private' | 'presence') => void | Promise<void>
  
    /**
     * Check if connected to the broadcasting service
     */
    isConnected: () => boolean
  }
  
  export interface BroadcastEvent {
    /**
     * The name of the event
     */
    name: string
  
    /**
     * The channel the event was broadcast on
     */
    channel: string
  
    /**
     * The type of channel
     */
    channelType: 'public' | 'private' | 'presence'
  
    /**
     * The data associated with the event
     */
    data?: any
  
    /**
     * The timestamp of when the event was broadcast
     */
    timestamp: number
  }
  
  export interface BroadcastConfig {
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
  