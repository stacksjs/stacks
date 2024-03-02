import { localTunnel } from './tunnel'

export async function createLocalTunnel(port: number) {
  const tunnel = await localTunnel({ port })
  return tunnel.url
}

export { localTunnel }
