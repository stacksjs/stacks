import * as net from 'node:net'
import * as https from 'node:https'
import * as fs from 'node:fs'
import path from 'node:path'
import type { Buffer } from 'node:buffer'

// Load SSL certificate and key
const options = {
  key: fs.readFileSync(path.resolve(__dirname, '../../../../../server/stacks.localhost-key.pem')),
  cert: fs.readFileSync(path.resolve(__dirname, '../../../../../server/stacks.localhost.pem')),
}

const server: https.Server = https.createServer(options)

server.on('secureConnection', (clientToProxySocket: net.Socket) => {
  // eslint-disable-next-line no-console
  console.log('Client connected to proxy')

  clientToProxySocket.once('data', (data: Buffer) => {
    const dataStr: string = data.toString()

    // Default to HTTPS port since all connections are secure
    let serverPort: number = 443
    let serverAddress: string = 'localhost'

    // eslint-disable-next-line no-console
    console.log(dataStr)

    // Extract the host from the HTTP request
    const hostHeader = dataStr.split('Host: ')[1]?.split('\r\n')[0]

    // eslint-disable-next-line no-console
    console.log('hostHeader', hostHeader)

    if (hostHeader?.includes('stacks.localhost')) {
      // If the request is for stacks.localhost, proxy to localhost:3006
      serverPort = 3006
    }
    else {
      // For other hosts, extract the address normally
      serverAddress = hostHeader ?? 'localhost'
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
