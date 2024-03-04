import * as net from 'node:net'
import * as https from 'node:https'
import * as fs from 'node:fs'
import path from 'node:path'
import type { Buffer } from 'node:buffer'
import { log } from '@stacksjs/cli'
import config from '../reverse-proxy.config'

interface Option {
  from: string // domain to proxy, e.g. localhost:3000
  to?: string // domain to proxy to, defaults to stacks.localhost
  keyPath?: string // absolute path to the key
  certPath?: string // absolute path to the cert
}

type Options = Option | Option[]

export function startProxy(option: Option): void {
  startProxies(option)
}

export function startProxies(options: Options): void {
  if (Array.isArray(options)) {
    options.forEach((option: Option) => {
      startServer(option)
    })
  }
  else {
    startServer(options)
  }
}

export function startServer(option: Option): void {
  // Start the reverse proxy
  log.info('Starting Reverse Proxy Server')

  const keyPath = option.keyPath || path.resolve(__dirname, `../../../../../storage/keys/${option.to}.key`)
  const key = fs.readFileSync(keyPath)
  const certPath = option.certPath || path.resolve(__dirname, `../../../../../storage/keys/${option.to}.pem`)
  const cert = fs.readFileSync(certPath)

  const server: https.Server = https.createServer({
    key,
    cert,
  })

  server.on('secureConnection', (clientToProxySocket: net.Socket) => {
    // eslint-disable-next-line no-console
    console.log('Client connected to proxy')

    clientToProxySocket.once('data', (data: Buffer) => {
      const dataStr: string = data.toString()
      const hostHeader = dataStr.split('Host: ')[1]?.split('\r\n')[0]

      // eslint-disable-next-line no-console
      console.log(dataStr)
      // eslint-disable-next-line no-console
      console.log('hostHeader', hostHeader)

      // Default to HTTPS port since all connections are secure
      let serverPort: number = 443
      const serverAddress: string = 'localhost'

      // Check if the hostHeader matches any key in the config
      const matchingKey = Object.keys(config).find(key => hostHeader === config[key])
      if (matchingKey) {
        // Extract the port from the matching key (assuming the format "localhost:PORT")
        const port = matchingKey.split(':')[1]
        if (port)
          serverPort = Number.parseInt(port, 10)

        // The serverAddress remains 'localhost' or could be adjusted based on your setup
      }

      // eslint-disable-next-line no-console
      console.log('serverAddress', serverAddress, 'serverPort', serverPort)

      // Creating a connection from proxy to destination server
      const proxyToServerSocket: net.Socket = net.createConnection({
        host: serverAddress,
        port: serverPort,
      }, () => {
        // eslint-disable-next-line no-console
        console.log('Proxy to server set up')
      })

      // Since all connections are secure, no need to write 'HTTP/1.1 200 OK\r\n\r\n'
      proxyToServerSocket.write(data)

      clientToProxySocket.pipe(proxyToServerSocket)
      proxyToServerSocket.pipe(clientToProxySocket)

      proxyToServerSocket.on('error', (err: Error) => {
        // eslint-disable-next-line no-console
        console.log('Proxy to server error')
        console.error(err)
      })

      clientToProxySocket.on('error', (err: Error) => {
        // eslint-disable-next-line no-console
        console.log('Client to proxy error')
        console.error(err)
      })
    })
  })

  server.on('error', (err: Error) => {
    // eslint-disable-next-line no-console
    console.log('Some internal server error occurred')
    console.error(err)
  })

  server.on('close', () => {
    // eslint-disable-next-line no-console
    console.log('Client disconnected')
  })

  server.listen(
    {
      host: '0.0.0.0',
      port: 8080,
    },
    () => {
      // eslint-disable-next-line no-console
      console.log('Server listening on 0.0.0.0:8080')
    },
  )
}
