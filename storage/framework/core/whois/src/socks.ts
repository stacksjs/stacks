/**
 * Native SOCKS client implementation using Bun's TCP APIs
 * Replaces the 'socks' npm package
 */

import Net from 'node:net'

export enum SocksVersion {
  SOCKS4 = 4,
  SOCKS5 = 5,
}

export interface SocksProxy {
  host: string
  port: number
  type: 4 | 5
  userId?: string
  password?: string
}

export interface SocksDestination {
  host: string
  port: number
}

export interface SocksClientOptions {
  proxy: SocksProxy
  command: 'connect' | 'bind' | 'associate'
  destination: SocksDestination
}

export interface SocksClientEstablishedEvent {
  socket: Net.Socket
  remoteHost?: string
  remotePort?: number
}

/**
 * Native SOCKS client implementation
 */
export class SocksClient {
  private options: SocksClientOptions

  constructor(options: SocksClientOptions) {
    this.options = options
  }

  /**
   * Create a SOCKS connection
   *
   * @param options SOCKS connection options
   * @param callback Callback with error or connection info
   */
  static createConnection(
    options: SocksClientOptions,
    callback: (err: Error | null, info?: SocksClientEstablishedEvent) => void,
  ): void {
    const client = new SocksClient(options)
    client.connect(callback)
  }

  /**
   * Establish SOCKS connection
   */
  private connect(callback: (err: Error | null, info?: SocksClientEstablishedEvent) => void): void {
    const socket = new Net.Socket()
    const { proxy, destination } = this.options

    socket.connect({ port: proxy.port, host: proxy.host }, () => {
      if (proxy.type === 5) {
        this.connectSocks5(socket, callback)
      }
      else {
        this.connectSocks4(socket, callback)
      }
    })

    socket.on('error', (err) => {
      callback(err)
    })
  }

  /**
   * SOCKS4 connection handshake
   */
  private connectSocks4(socket: Net.Socket, callback: (err: Error | null, info?: SocksClientEstablishedEvent) => void): void {
    const { destination, proxy } = this.options

    // SOCKS4 request format:
    // +----+----+----+----+----+----+----+----+----+----+....+----+
    // | VN | CD | DSTPORT |      DSTIP        | USERID       |NULL|
    // +----+----+----+----+----+----+----+----+----+----+....+----+
    //    1    1      2              4           variable       1

    const port = destination.port
    const userId = proxy.userId || ''

    // Parse IP address
    let ipBuffer: Buffer
    if (this.isIPv4(destination.host)) {
      const parts = destination.host.split('.').map(Number)
      ipBuffer = Buffer.from(parts)
    }
    else {
      // SOCKS4 doesn't support domain names, use SOCKS4a
      ipBuffer = Buffer.from([0, 0, 0, 1]) // Special marker for SOCKS4a
    }

    const request = Buffer.concat([
      Buffer.from([0x04]), // VN (SOCKS version 4)
      Buffer.from([0x01]), // CD (CONNECT command)
      Buffer.from([(port >> 8) & 0xFF, port & 0xFF]), // DSTPORT (2 bytes)
      ipBuffer, // DSTIP (4 bytes)
      Buffer.from(userId), // USERID
      Buffer.from([0x00]), // NULL terminator
    ])

    // For SOCKS4a with domain name
    if (!this.isIPv4(destination.host)) {
      const domainBuffer = Buffer.concat([
        request,
        Buffer.from(destination.host),
        Buffer.from([0x00]), // NULL terminator
      ])
      socket.write(domainBuffer)
    }
    else {
      socket.write(request)
    }

    // Read response
    socket.once('data', (data) => {
      // SOCKS4 response format:
      // +----+----+----+----+----+----+----+----+
      // | VN | CD | DSTPORT |      DSTIP        |
      // +----+----+----+----+----+----+----+----+
      //    1    1      2              4

      if (data.length < 8) {
        callback(new Error('Invalid SOCKS4 response'))
        return
      }

      const status = data[1]
      if (status !== 0x5A) {
        // 0x5A = request granted
        callback(new Error(`SOCKS4 connection failed with status: ${status}`))
        return
      }

      callback(null, { socket })
    })
  }

  /**
   * SOCKS5 connection handshake
   */
  private connectSocks5(socket: Net.Socket, callback: (err: Error | null, info?: SocksClientEstablishedEvent) => void): void {
    const { destination, proxy } = this.options

    // Step 1: Authentication method negotiation
    let authMethods: number[]
    if (proxy.userId && proxy.password) {
      authMethods = [0x00, 0x02] // No auth and username/password auth
    }
    else {
      authMethods = [0x00] // No authentication
    }

    const greeting = Buffer.from([
      0x05, // SOCKS version
      authMethods.length, // Number of auth methods
      ...authMethods,
    ])

    socket.write(greeting)

    socket.once('data', (data) => {
      if (data.length < 2 || data[0] !== 0x05) {
        callback(new Error('Invalid SOCKS5 greeting response'))
        return
      }

      const selectedMethod = data[1]

      if (selectedMethod === 0xFF) {
        callback(new Error('No acceptable authentication methods'))
        return
      }

      // Step 2: Authentication (if required)
      if (selectedMethod === 0x02) {
        this.authenticateSocks5(socket, callback)
      }
      else {
        this.sendConnectRequest(socket, callback)
      }
    })
  }

  /**
   * SOCKS5 username/password authentication
   */
  private authenticateSocks5(socket: Net.Socket, callback: (err: Error | null, info?: SocksClientEstablishedEvent) => void): void {
    const { proxy } = this.options
    const username = proxy.userId || ''
    const password = proxy.password || ''

    const authRequest = Buffer.concat([
      Buffer.from([0x01]), // Auth version
      Buffer.from([username.length]),
      Buffer.from(username),
      Buffer.from([password.length]),
      Buffer.from(password),
    ])

    socket.write(authRequest)

    socket.once('data', (data) => {
      if (data.length < 2 || data[0] !== 0x01) {
        callback(new Error('Invalid SOCKS5 auth response'))
        return
      }

      if (data[1] !== 0x00) {
        callback(new Error('SOCKS5 authentication failed'))
        return
      }

      this.sendConnectRequest(socket, callback)
    })
  }

  /**
   * Send SOCKS5 CONNECT request
   */
  private sendConnectRequest(socket: Net.Socket, callback: (err: Error | null, info?: SocksClientEstablishedEvent) => void): void {
    const { destination } = this.options
    const port = destination.port

    let addressBuffer: Buffer
    let addressType: number

    if (this.isIPv4(destination.host)) {
      // IPv4 address
      addressType = 0x01
      const parts = destination.host.split('.').map(Number)
      addressBuffer = Buffer.from(parts)
    }
    else if (this.isIPv6(destination.host)) {
      // IPv6 address
      addressType = 0x04
      // Parse IPv6 (simplified)
      const parts = destination.host.split(':')
      const bytes: number[] = []
      for (const part of parts) {
        const value = Number.parseInt(part, 16)
        bytes.push((value >> 8) & 0xFF, value & 0xFF)
      }
      addressBuffer = Buffer.from(bytes)
    }
    else {
      // Domain name
      addressType = 0x03
      addressBuffer = Buffer.concat([
        Buffer.from([destination.host.length]),
        Buffer.from(destination.host),
      ])
    }

    const request = Buffer.concat([
      Buffer.from([
        0x05, // SOCKS version
        0x01, // CONNECT command
        0x00, // Reserved
        addressType, // Address type
      ]),
      addressBuffer,
      Buffer.from([(port >> 8) & 0xFF, port & 0xFF]), // Port (2 bytes)
    ])

    socket.write(request)

    socket.once('data', (data) => {
      if (data.length < 10 || data[0] !== 0x05) {
        callback(new Error('Invalid SOCKS5 connect response'))
        return
      }

      const status = data[1]
      if (status !== 0x00) {
        const errors: { [key: number]: string } = {
          0x01: 'General SOCKS server failure',
          0x02: 'Connection not allowed by ruleset',
          0x03: 'Network unreachable',
          0x04: 'Host unreachable',
          0x05: 'Connection refused',
          0x06: 'TTL expired',
          0x07: 'Command not supported',
          0x08: 'Address type not supported',
        }
        const errorMsg = errors[status] || `Unknown error (${status})`
        callback(new Error(`SOCKS5 connection failed: ${errorMsg}`))
        return
      }

      callback(null, { socket })
    })
  }

  /**
   * Check if string is a valid IPv4 address
   */
  private isIPv4(address: string): boolean {
    const ipv4Regex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipv4Regex.test(address))
      return false

    const parts = address.split('.').map(Number)
    return parts.every(part => part >= 0 && part <= 255)
  }

  /**
   * Check if string is a valid IPv6 address (simplified)
   */
  private isIPv6(address: string): boolean {
    return address.includes(':') && address.split(':').length >= 3
  }
}

// Backward compatibility exports
export type { SocksClientOptions, SocksClientEstablishedEvent }
