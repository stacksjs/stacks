import type { Socket } from 'node:net'
import { createConnection, createServer } from 'node:net'

export function createServeRelay(host: string, port: number) {
  let current: ReturnType<typeof createTarget> | undefined
  let sequence = 0
  const server = createServer({ pauseOnConnect: true, allowHalfOpen: true }, (client) => {
    if (current)
      current.connect(client, ++sequence)
    else
      client.destroy()
  })
  const listening = new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen({ host, port, exclusive: true }, () => {
      server.off('error', reject)
      resolve()
    })
  })

  function createTarget(port: number, send: (message: unknown) => boolean) {
    const connections = new Map<number, { close: () => void, accept: () => void }>()
    let drained: (() => void) | undefined
    return {
      connect(client: Socket, id: number) {
        const { remoteAddress: address, remotePort: portOfPeer } = client
        if (!address || !portOfPeer) {
          client.destroy()
          return
        }
        const upstream = createConnection({ host: '127.0.0.1', port, allowHalfOpen: true })
        upstream.pause()
        let source: number | undefined
        const close = () => {
          if (!connections.delete(id))
            return
          clearTimeout(timeout)
          if (source)
            send({ type: 'stacks:serve-peer-close', id, source })
          client.destroy()
          upstream.destroy()
          if (!connections.size)
            drained?.()
        }
        const timeout = setTimeout(close, 5000)
        connections.set(id, {
          close,
          accept() {
            clearTimeout(timeout)
            // These pipes preserve the original HTTP bytes and upgrades, with
            // Node stream backpressure in both directions.
            client.pipe(upstream)
            upstream.pipe(client)
          },
        })
        client.on('error', close).on('close', close)
        upstream.on('error', close).on('close', close)
        upstream.once('connect', () => {
          source = upstream.localPort
          if (!source || !send({ type: 'stacks:serve-peer', id, source, address, port: portOfPeer }))
            close()
        })
      },
      onMessage(message: unknown) {
        if (message && typeof message === 'object' && 'type' in message && message.type === 'stacks:serve-peer-ready'
          && 'id' in message && typeof message.id === 'number')
          connections.get(message.id)?.accept()
      },
      close() {
        for (const connection of connections.values())
          connection.close()
      },
      async drain(timeoutMs: number) {
        if (!connections.size)
          return
        const { promise, resolve } = Promise.withResolvers<void>()
        drained = resolve
        const timer = setTimeout(resolve, timeoutMs)
        try {
          await promise
        }
        finally {
          clearTimeout(timer)
          drained = undefined
        }
      },
    }
  }

  return {
    listening,
    createTarget,
    promote(target: ReturnType<typeof createTarget>) { current = target },
    stop() {
      current = undefined
      server.close()
    },
  }
}
