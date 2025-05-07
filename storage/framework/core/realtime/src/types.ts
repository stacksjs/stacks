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
  broadcastEvent(): Promise<void>
  broadcastEventNow(): Promise<void>
  setChannel(channel: string): this
  excludeCurrentUser(): this
  setPresenceChannel(): this
  setPrivateChannel(): this
}

export interface BroadcastConfig {
  channel?: string
  event?: string
  handle?: (data: any) => Promise<void>
}
