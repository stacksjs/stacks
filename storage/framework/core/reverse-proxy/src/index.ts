import * as net from 'node:net'
import type { Buffer } from 'node:buffer'

const server: net.Server = net.createServer()

server.on('connection', (clientToProxySocket: net.Socket) => {
  // eslint-disable-next-line no-console
  console.log('Client connected to proxy')

  clientToProxySocket.once('data', (data: Buffer) => {
    const dataStr: string = data.toString()
    const isTLSConnection: boolean = dataStr.includes('CONNECT')

    let serverPort: number = 80
    let serverAddress: string

    // eslint-disable-next-line no-console
    console.log(dataStr)

    if (isTLSConnection) {
      serverPort = 443
      serverAddress = dataStr.split('CONNECT')[1]?.split(' ')[1] ?? 'defaultServerAddress'
    }
    else {
      serverAddress = dataStr.split('Host: ')[1]?.split('\r\n')[0] ?? 'defaultServerAddress'
    }

    // eslint-disable-next-line no-console
    console.log(serverAddress)

    // Creating a connection from proxy to destination server
    const proxyToServerSocket: net.Socket = net.createConnection(
      {
        host: serverAddress,
        port: serverPort,
      },
      () => {
        // eslint-disable-next-line no-console
        console.log('Proxy to server set up')
      },
    )

    if (isTLSConnection)
      clientToProxySocket.write('HTTP/1.1 200 OK\r\n\r\n')
    else
      proxyToServerSocket.write(data)

    clientToProxySocket.pipe(proxyToServerSocket)
    proxyToServerSocket.pipe(clientToProxySocket)

    proxyToServerSocket.on('error', (err: Error) => {
      // eslint-disable-next-line no-console
      console.log('Proxy to server error')
      // eslint-disable-next-line no-console
      console.log(err)
    })

    clientToProxySocket.on('error', (err: Error) => {
    // eslint-disable-next-line no-console
      console.log('Client to proxy error')
      // eslint-disable-next-line no-console
      console.log(err)
    })
  })
})

server.on('error', (err: Error) => {
  // eslint-disable-next-line no-console
  console.log('Some internal server error occurred')
  // eslint-disable-next-line no-console
  console.log(err)
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
