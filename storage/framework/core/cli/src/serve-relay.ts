import type { Socket } from 'node:net'
import type { OwnedProcess } from './owned-process'
import { createConnection, createServer } from 'node:net'

export function createServeRelay(host: string, port: number, onActivity?: () => void) {
  let current: ReturnType<typeof createTarget> | undefined
  let sequence = 0
  const server = createServer({ pauseOnConnect: true, allowHalfOpen: true }, (client) => {
    if (current)
      current.connect(client, ++sequence)
    else
      client.destroy()
  })
  const listening = new Promise<number>((resolve, reject) => {
    server.once('error', reject)
    server.listen({ host, port, exclusive: true }, () => {
      server.off('error', reject)
      const address = server.address()
      if (address && typeof address !== 'string')
        resolve(address.port)
      else
        reject(new Error('Could not determine the relay port.'))
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
            if (onActivity)
              client.on('data', onActivity)
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

export async function reserveRelayWorkerPort(): Promise<number> {
  const reservation = Bun.serve({ hostname: '127.0.0.1', port: 0, fetch: () => new Response() })
  const port = reservation.port!
  await reservation.stop(true)
  return port
}

export async function retireRelayWorker(
  child: OwnedProcess,
  target: ReturnType<ReturnType<typeof createServeRelay>['createTarget']>,
  grace: number,
): Promise<void> {
  const deadline = Date.now() + grace
  await target.drain(grace)
  child.send({ type: 'stacks:serve-drain' })
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    await Promise.race([
      child.exited,
      new Promise<void>(resolve => { timer = setTimeout(resolve, Math.max(deadline - Date.now(), 250)) }),
    ])
  }
  finally {
    clearTimeout(timer)
    target.close()
    await child.stop()
  }
}
