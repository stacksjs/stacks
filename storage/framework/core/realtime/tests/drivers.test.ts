import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test'
import { PusherDriver } from '../src/drivers/pusher'
import { SocketDriver } from '../src/drivers/socket'

// Mock Pusher
const mockPusher = {
  trigger: mock(() => {}),
}

mock.module('pusher', () => {
  return {
    default: mock(() => mockPusher),
  }
})

// Mock Socket.IO
const mockSocketServer = {
  on: mock(() => {}),
  emit: mock(() => {}),
  close: mock(() => {}),
  to: mock(() => mockSocketServer),
  sockets: {
    removeAllListeners: mock(() => {}),
    adapter: {
      rooms: new Map(),
    },
  },
}

mock.module('socket.io', () => {
  return {
    Server: mock(() => mockSocketServer),
  }
})

describe('Realtime Drivers', () => {
  describe('PusherDriver', () => {
    let pusherDriver: PusherDriver

    beforeEach(() => {
      pusherDriver = new PusherDriver()
    })

    afterEach(async () => {
      await pusherDriver.disconnect()
    })

    it('should connect successfully', async () => {
      await pusherDriver.connect()
      expect(pusherDriver.isConnected()).toBe(true)
    })

    it('should disconnect successfully', async () => {
      await pusherDriver.connect()
      await pusherDriver.disconnect()
      expect(pusherDriver.isConnected()).toBe(false)
    })

    it('should subscribe to a channel', async () => {
      await pusherDriver.connect()
      const callback = mock(() => {})
      pusherDriver.subscribe('test-channel', callback)
      expect(mockPusher.trigger).toHaveBeenCalled()
    })

    it('should publish to a channel', async () => {
      await pusherDriver.connect()
      const testData = { message: 'test' }
      pusherDriver.publish('test-channel', testData)
      expect(mockPusher.trigger).toHaveBeenCalledWith('test-channel', 'message', testData)
    })

    it('should broadcast to a public channel', async () => {
      await pusherDriver.connect()
      const testData = { message: 'test' }
      pusherDriver.broadcast('test-channel', 'test-event', testData, 'public')
      expect(mockPusher.trigger).toHaveBeenCalledWith('test-channel', 'test-event', {
        event: 'test-event',
        channel: 'test-channel',
        data: testData,
      })
    })

    it('should broadcast to a private channel', async () => {
      await pusherDriver.connect()
      const testData = { message: 'test' }
      pusherDriver.broadcast('test-channel', 'test-event', testData, 'private')
      expect(mockPusher.trigger).toHaveBeenCalledWith('private-test-channel', 'test-event', {
        event: 'test-event',
        channel: 'private-test-channel',
        data: testData,
      })
    })

    it('should broadcast to a presence channel', async () => {
      await pusherDriver.connect()
      const testData = { message: 'test' }
      pusherDriver.broadcast('test-channel', 'test-event', testData, 'presence')
      expect(mockPusher.trigger).toHaveBeenCalledWith('presence-test-channel', 'test-event', {
        event: 'test-event',
        channel: 'presence-test-channel',
        data: testData,
      })
    })

    it('should handle broadcastable interface methods', async () => {
      await pusherDriver.connect()
      const testData = { message: 'test' }

      pusherDriver
        .setChannel('test-channel')
        .setEvent('test-event', testData)
        .setPrivateChannel()

      await pusherDriver.broadcastEvent()

      expect(mockPusher.trigger).toHaveBeenCalledWith('private-test-channel', 'test-event', {
        event: 'test-event',
        channel: 'private-test-channel',
        data: testData,
      })
    })
  })

  describe('SocketDriver', () => {
    let socketDriver: SocketDriver

    beforeEach(() => {
      socketDriver = new SocketDriver()
    })

    afterEach(async () => {
      await socketDriver.disconnect()
    })

    it('should connect successfully', async () => {
      await socketDriver.connect()
      expect(socketDriver.isConnected()).toBe(true)
    })

    it('should disconnect successfully', async () => {
      await socketDriver.connect()
      await socketDriver.disconnect()
      expect(socketDriver.isConnected()).toBe(false)
    })

    it('should subscribe to a channel', async () => {
      await socketDriver.connect()
      const callback = mock(() => {})
      socketDriver.subscribe('test-channel', callback)
      expect(mockSocketServer.on).toHaveBeenCalled()
    })

    it('should publish to a channel', async () => {
      await socketDriver.connect()
      const testData = { message: 'test' }
      socketDriver.publish('test-channel', testData)
      expect(mockSocketServer.emit).toHaveBeenCalledWith('test-channel', testData)
    })

    it('should broadcast to a public channel', async () => {
      await socketDriver.connect()
      const testData = { message: 'test' }
      socketDriver.broadcast('test-channel', 'test-event', testData, 'public')
      expect(mockSocketServer.emit).toHaveBeenCalledWith('test-event', {
        event: 'test-event',
        channel: 'test-channel',
        data: testData,
      })
    })

    it('should broadcast to a private channel', async () => {
      await socketDriver.connect()
      const testData = { message: 'test' }
      socketDriver.broadcast('test-channel', 'test-event', testData, 'private')
      expect(mockSocketServer.to).toHaveBeenCalledWith('private-test-channel')
    })

    it('should broadcast to a presence channel', async () => {
      await socketDriver.connect()
      const testData = { message: 'test' }
      socketDriver.broadcast('test-channel', 'test-event', testData, 'presence')
      expect(mockSocketServer.to).toHaveBeenCalledWith('presence-test-channel')
    })

    it('should handle broadcastable interface methods', async () => {
      await socketDriver.connect()
      const testData = { message: 'test' }

      socketDriver
        .setChannel('test-channel')
        .setEvent('test-event', testData)
        .setPrivateChannel()

      await socketDriver.broadcastEvent()

      expect(mockSocketServer.to).toHaveBeenCalledWith('private-test-channel')
    })

    it('should handle excluding current user', async () => {
      await socketDriver.connect()
      const testData = { message: 'test' }

      socketDriver
        .setChannel('test-channel')
        .setEvent('test-event', testData)
        .excludeCurrentUser()

      await socketDriver.broadcastEvent()

      expect(mockSocketServer.to).toHaveBeenCalledWith('test-channel')
    })
  })
})
