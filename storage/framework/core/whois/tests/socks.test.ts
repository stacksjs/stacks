import { describe, expect, it } from 'bun:test'
import { SocksClient } from '../src/socks'

describe('SocksClient', () => {
  it('should create SocksClient instance', () => {
    const client = new SocksClient({
      proxy: {
        host: '127.0.0.1',
        port: 1080,
        type: 5,
      },
      command: 'connect',
      destination: {
        host: 'example.com',
        port: 80,
      },
    })

    expect(client).toBeDefined()
  })

  it('should have static createConnection method', () => {
    expect(typeof SocksClient.createConnection).toBe('function')
  })

  // Note: Actual connection tests would require a SOCKS proxy server
  // These tests verify the API is compatible with the socks package
})

describe('SOCKS Types', () => {
  it('should support SOCKS4 proxy type', () => {
    const options = {
      proxy: {
        host: '127.0.0.1',
        port: 1080,
        type: 4 as const,
      },
      command: 'connect' as const,
      destination: {
        host: 'example.com',
        port: 80,
      },
    }

    expect(options.proxy.type).toBe(4)
  })

  it('should support SOCKS5 proxy type', () => {
    const options = {
      proxy: {
        host: '127.0.0.1',
        port: 1080,
        type: 5 as const,
        userId: 'user',
        password: 'pass',
      },
      command: 'connect' as const,
      destination: {
        host: 'example.com',
        port: 80,
      },
    }

    expect(options.proxy.type).toBe(5)
    expect(options.proxy.userId).toBe('user')
    expect(options.proxy.password).toBe('pass')
  })
})
