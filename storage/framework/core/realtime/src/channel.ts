import { Broadcast } from './broadcast'

export class Channel {
  private channel: string
  private broadcastInstance: Broadcast = new Broadcast()

  constructor(channel: string) {
    this.channel = channel
  }

  async private(event: string, data?: any): Promise<void> {
    await this.broadcastInstance.connect()
    this.broadcastInstance.broadcast(this.channel, event, data, 'private')
  }

  async public(event: string, data?: any): Promise<void> {
    await this.broadcastInstance.connect()
    this.broadcastInstance.broadcast(this.channel, event, data, 'public')
  }

  async presence(event: string, data?: any): Promise<void> {
    await this.broadcastInstance.connect()
    this.broadcastInstance.broadcast(this.channel, event, data, 'presence')
  }
}

export function channel(name: string): Channel {
  return new Channel(name)
}
