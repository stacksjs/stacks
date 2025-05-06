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