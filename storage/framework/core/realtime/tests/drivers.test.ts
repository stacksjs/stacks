import { describe, expect, it, beforeEach, afterEach, mock } from 'bun:test'
import { PusherDriver } from '../src/drivers/pusher'
import { SocketDriver } from '../src/drivers/socket'
import { config } from '@stacksjs/config'

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
  sockets: {
    removeAllListeners: mock(() => {}),
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
  })
}) 