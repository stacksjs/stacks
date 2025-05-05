export type DriverType = 'socket' | 'pusher' | 'bun' // Add more driver types as needed

export interface RealtimeDriver {
  connect: () => Promise<void>
  disconnect: () => Promise<void>
  subscribe: (channel: string, callback: (data: any) => void) => void
  unsubscribe: (channel: string) => void
  publish: (channel: string, data: any) => void
  isConnected: () => boolean
}
